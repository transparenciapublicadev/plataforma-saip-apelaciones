"""Operate one explicit Compose project. No resource creation, volume removal or secrets output."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SERVICES = ('db', 'backend', 'frontend', 'proxy')
SECRET_NAMES = ('DB_ADMIN_PASSWORD', 'DB_PASSWORD', 'JWT_SECRET', 'APP_STORAGE_S3_ACCESS_KEY',
                'APP_STORAGE_S3_SECRET_KEY', 'SPRING_MAIL_PASSWORD')


def settings(path: Path) -> dict[str, str]:
    path = path.resolve(strict=True)
    if path.is_relative_to(REPO):
        raise ValueError('Keep runtime settings and secrets outside the checkout')
    result = {}
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        key, sep, value = line.partition('=')
        if not sep or not re.fullmatch(r'[A-Z][A-Z0-9_]*', key.strip()):
            raise ValueError('Use literal KEY=value settings, never shell commands')
        result[key.strip()] = value.strip().strip('"\'')
    if not re.fullmatch(r'yaiku-[a-z0-9-]+', result.get('COMPOSE_PROJECT_NAME', '')):
        raise ValueError('An explicit unique yaiku- Compose project is required')
    for key in ('POSTGRES_DB', 'POSTGRES_USER', 'DB_APP_USER'):
        if not re.fullmatch(r'[a-z][a-z0-9_]{0,50}', result.get(key, '')):
            raise ValueError(f'{key} must be a simple explicit identifier')
    if result['POSTGRES_USER'] == result['DB_APP_USER']:
        raise ValueError('Database operator and application roles must differ')
    return result


def external_directory(value: str) -> Path:
    path = Path(value)
    if not value or not path.is_absolute():
        raise ValueError('An absolute private directory is required')
    path = path.resolve()
    if path == Path(path.anchor) or path.is_relative_to(REPO):
        raise ValueError('Private directories must be outside the checkout, never a filesystem root')
    return path


def preflight(values: dict[str, str]) -> None:
    from urllib.parse import urlsplit
    for key in ('PUBLIC_ORIGIN', 'APP_STORAGE_S3_ENDPOINT'):
        u = urlsplit(values.get(key, ''))
        if u.scheme != 'https' or not u.hostname or '*' in u.hostname or u.username or u.password or u.query or u.fragment:
            raise ValueError(f'{key} must use HTTPS without embedded credentials')
    if urlsplit(values['PUBLIC_ORIGIN']).path not in ('', '/'):
        raise ValueError('PUBLIC_ORIGIN must not contain a path')
    for key in ('APP_STORAGE_S3_REGION', 'APP_STORAGE_S3_BUCKET', 'SPRING_MAIL_HOST',
                'SPRING_MAIL_USERNAME', 'APP_NOTIFICATIONS_MAIL_FROM'):
        if not values.get(key) or any(word in values[key].lower() for word in ('replace', '.invalid', 'example.')):
            raise ValueError(f'{key} requires a real reviewed value before production start')
    secrets = external_directory(values.get('YAIKU_SECRETS_DIR', ''))
    for name in SECRET_NAMES:
        value = (secrets / name).read_text().strip()
        if not value or any(word in value.lower() for word in ('replace_me', 'development-only', 'changeme')):
            raise ValueError(f'{name} is missing or a placeholder; its value is not printed')
        if name == 'JWT_SECRET' and len(value.encode()) < 64:
            raise ValueError('Generate a new random JWT secret of at least 64 bytes')
    tls = external_directory(values.get('YAIKU_TLS_DIR', ''))
    for name in ('fullchain.pem', 'privkey.pem'):
        if not (tls / name).is_file():
            raise ValueError('A certificate chain and private key are required; TLS is never silently bypassed')


def compose(env: Path, values: dict[str, str], *args: str, **kwargs):
    # Never source a file, use shell=True, or print expanded Compose configuration.
    command = ['docker', 'compose', '--env-file', str(env.resolve()), '-p',
               values['COMPOSE_PROJECT_NAME'], '-f', str(HERE / 'compose.yml'), *args]
    child_environment = dict(os.environ)
    # OS variables normally outrank --env-file. Eliminate that accidental overlay
    # for this child only; preserve Docker context/security configuration.
    for name in re.findall(r'\$\{([A-Z][A-Z0-9_]*)', (HERE / 'compose.yml').read_text()):
        child_environment.pop(name, None)
    return subprocess.run(command, check=True, env=child_environment, **kwargs)


def write_manifest(dump: Path, project: str, database: str) -> None:
    with dump.open('rb') as source:
        checksum = hashlib.file_digest(source, 'sha256').hexdigest()
    metadata = dict(createdAt=datetime.now(timezone.utc).isoformat(), project=project,
                    database=database, sha256=checksum,
                    note='Database only. S3 object bytes require a separate consistent backup.')
    dump.with_suffix('.json').write_text(json.dumps(metadata, indent=2), encoding='utf8')
    os.chmod(dump, 0o600)
    os.chmod(dump.with_suffix('.json'), 0o600)


def verify_dump(dump: Path, project: str) -> dict:
    metadata = json.loads(dump.with_suffix('.json').read_text(encoding='utf8'))
    with dump.open('rb') as source:
        actual = hashlib.file_digest(source, 'sha256').hexdigest()
    if actual != metadata['sha256'] or metadata['project'] != project:
        raise ValueError('Backup integrity/project mismatch; no database operation performed')
    return metadata


def retain(directory: Path, project: str, count: int) -> None:
    # Only matching files inside this resolved private directory; never recursive deletion.
    prefix = project + '-'
    dumps = sorted(directory.glob(prefix + '*.dump'), key=lambda p: p.name, reverse=True)
    for dump in dumps[count:]:
        if dump.is_symlink() or dump.resolve().parent != directory.resolve():
            raise ValueError('Refusing retention outside the private backup directory')
        verify_dump(dump, project)
        dump.unlink()
        dump.with_suffix('.json').unlink()


def backup(env: Path, values: dict[str, str], keep: int) -> Path:
    directory = external_directory(values.get('YAIKU_BACKUP_DIR', ''))
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    dump = directory / (values['COMPOSE_PROJECT_NAME'] + '-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.dump')
    # Quiesce writes for DB/object consistency, not for pg_dump's snapshot semantics.
    result = compose(env, values, 'ps', '--status', 'running', '--services', capture_output=True, text=True)
    if 'backend' in result.stdout.splitlines():
        raise ValueError('Stop backend (and incoming writes) before the coordinated DB/object backup')
    try:
        with dump.open('xb') as target:
            os.chmod(dump, 0o600)
            compose(env, values, 'exec', '-T', 'db', 'pg_dump', '-U', values['POSTGRES_USER'],
                    '-d', values['POSTGRES_DB'], '-Fc', '--no-owner', '--no-acl', stdout=target)
        write_manifest(dump, values['COMPOSE_PROJECT_NAME'], values['POSTGRES_DB'])
    except Exception:
        # Keep failed output, labeled incomplete; never present it as a usable backup.
        if dump.exists():
            dump.rename(dump.with_suffix('.incomplete'))
        raise
    retain(directory, values['COMPOSE_PROJECT_NAME'], keep)
    return dump


def restore(env: Path, values: dict[str, str], dump: Path, target: str) -> None:
    if not re.fullmatch(r'yaiku_restore_[a-z0-9_]{1,35}', target):
        raise ValueError('Restore only into a new explicit yaiku_restore_ database')
    verify_dump(dump, values['COMPOSE_PROJECT_NAME'])
    # createdb fails if the target exists. Never DROP, --clean, or restore into production.
    compose(env, values, 'exec', '-T', 'db', 'createdb', '-U', values['POSTGRES_USER'], '-O', values['DB_APP_USER'], target)
    with dump.open('rb') as source:
        compose(env, values, 'exec', '-T', 'db', 'pg_restore', '-U', values['POSTGRES_USER'],
                '-d', target, '--role='+values['DB_APP_USER'], '--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', stdin=source)
    compose(env, values, 'exec', '-T', 'db', 'psql', '-X', '-U', values['POSTGRES_USER'],
            '-d', target, '-v', 'ON_ERROR_STOP=1', '-c',
            'SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', required=True, type=Path)
    parser.add_argument('action', choices=('config', 'build', 'start', 'stop', 'status', 'backup', 'restore'))
    parser.add_argument('--service', choices=SERVICES)
    parser.add_argument('--keep', type=int, choices=range(1, 32), default=7)
    parser.add_argument('--dump', type=Path)
    parser.add_argument('--target')
    args = parser.parse_args()
    values = settings(args.env_file)
    if args.action != 'config':
        host_override = os.environ.get('DOCKER_HOST', '')
        endpoint = subprocess.run(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
                                  capture_output=True, text=True, check=True).stdout.strip()
        if (host_override and not host_override.startswith(('unix://', 'npipe://'))) or not endpoint.startswith(('unix://', 'npipe://')):
            raise ValueError('Only a local Docker socket is allowed; no remote deployment is performed')
    if args.action == 'config':
        compose(args.env_file, values, 'config', '--quiet')
    elif args.action == 'build':
        compose(args.env_file, values, 'build', *( [args.service] if args.service else [] ))
    elif args.action == 'start':
        preflight(values)
        for service in ( [args.service] if args.service else SERVICES ):
            compose(args.env_file, values, 'up', '-d', '--no-build', '--wait', service)
    elif args.action == 'stop':
        compose(args.env_file, values, 'stop', *( [args.service] if args.service else reversed(SERVICES) ))
    elif args.action == 'status':
        compose(args.env_file, values, 'ps', '--all')
    elif args.action == 'backup':
        print(backup(args.env_file, values, args.keep))
    elif args.action == 'restore':
        if not args.dump or not args.target:
            parser.error('restore requires --dump and --target; never the live database')
        restore(args.env_file, values, args.dump.resolve(strict=True), args.target)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError, KeyError) as error:
        # No environment/configuration/secret dumps on failure.
        print('Operation refused or failed: ' + (str(error) if isinstance(error, ValueError) else type(error).__name__), file=sys.stderr)
        raise SystemExit(1)
