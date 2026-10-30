"""Control-flow tests only. Actual Docker/PostgreSQL checks are reported separately."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('stack', Path(__file__).with_name('stack.py'))
stack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stack)


class StackTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.values = {'COMPOSE_PROJECT_NAME': 'yaiku-own-test', 'POSTGRES_USER': 'own',
                       'POSTGRES_DB': 'own', 'DB_APP_USER': 'own_app', 'YAIKU_BACKUP_DIR': str(self.root)}

    def tearDown(self):
        self.temp.cleanup()

    def test_refuses_environment_inside_checkout(self):
        with self.assertRaisesRegex(ValueError, 'outside'):
            stack.settings(Path(__file__).with_name('runtime.env.example'))

    def test_refuses_unscoped_project_and_unsafe_database(self):
        file = self.root / 'runtime.env'
        for invalid in ['COMPOSE_PROJECT_NAME=other', 'COMPOSE_PROJECT_NAME=yaiku-ok\nPOSTGRES_DB=bad;DROP']:
            file.write_text(invalid)
            with self.assertRaises(ValueError):
                stack.settings(file)

    def test_no_environment_shell_execution(self):
        file = self.root / 'runtime.env'
        file.write_text('COMPOSE_PROJECT_NAME=yaiku-ok\nPOSTGRES_DB=own\nPOSTGRES_USER=own\nDB_APP_USER=own_app\nTEXT=$(no-command-executed)')
        self.assertEqual(stack.settings(file)['TEXT'], '$(no-command-executed)')

    def test_private_path_cannot_be_repo_or_root(self):
        for path in ['', str(stack.REPO), Path(self.root.anchor)]:
            with self.assertRaises(ValueError):
                stack.external_directory(str(path))

    def test_refuses_fake_production_smtp(self):
        values = {**self.values, 'PUBLIC_ORIGIN': 'https://host.test',
                  'APP_STORAGE_S3_ENDPOINT': 'https://storage.test', 'APP_STORAGE_S3_REGION': 'region',
                  'APP_STORAGE_S3_BUCKET': 'private', 'SPRING_MAIL_HOST': 'smtp.example.invalid'}
        with self.assertRaisesRegex(ValueError, 'SPRING_MAIL_HOST'):
            stack.preflight(values)

    def test_public_origin_is_exact_without_wildcard_or_path(self):
        for origin in ('https://*.host.test', 'https://host.test/path'):
            with self.assertRaisesRegex(ValueError, 'PUBLIC_ORIGIN'):
                stack.preflight({**self.values, 'PUBLIC_ORIGIN': origin,
                                 'APP_STORAGE_S3_ENDPOINT': 'https://storage.test'})

    @patch.object(stack.subprocess, 'run')
    def test_compose_is_explicit_and_host_variables_cannot_overlay_file(self, run):
        with patch.dict(stack.os.environ, {'POSTGRES_DB': 'unrelated', 'DOCKER_CONTEXT': 'own-context'}):
            stack.compose(self.root / 'runtime.env', self.values, 'stop', 'backend')
        args, kwargs = run.call_args
        self.assertIn('-p', args[0])
        self.assertIn('yaiku-own-test', args[0])
        self.assertNotIn('POSTGRES_DB', kwargs['env'])
        self.assertEqual(kwargs['env']['DOCKER_CONTEXT'], 'own-context')
        self.assertNotIn('shell', kwargs)

    @patch.object(stack, 'compose')
    def test_restore_rejects_live_database_before_any_command(self, compose):
        with self.assertRaisesRegex(ValueError, 'new explicit'):
            stack.restore(self.root/'env', self.values, self.root/'dump', 'own')
        compose.assert_not_called()

    def test_changed_backup_is_rejected(self):
        dump = self.root/'backup.dump';dump.write_bytes(b'known synthetic dump')
        stack.write_manifest(dump, 'yaiku-own-test', 'own')
        dump.write_bytes(b'corrupted')
        with self.assertRaisesRegex(ValueError, 'integrity'):
            stack.verify_dump(dump, 'yaiku-own-test')

    @patch.object(stack, 'compose')
    def test_failed_restore_keeps_new_database_and_never_drops_or_cleans(self, compose):
        dump = self.root/'backup.dump';dump.write_bytes(b'synthetic')
        stack.write_manifest(dump, 'yaiku-own-test', 'own')
        compose.side_effect = [None, subprocess.CalledProcessError(1, 'pg_restore')]
        with self.assertRaises(subprocess.CalledProcessError):
            stack.restore(self.root/'env', self.values, dump, 'yaiku_restore_new')
        commands = [call.args for call in compose.call_args_list]
        self.assertEqual(len(commands), 2)
        self.assertTrue(any('createdb' in command for command in commands))
        self.assertFalse(any('--clean' in command or 'dropdb' in command for command in commands))

    @patch.object(stack, 'compose')
    def test_backup_requires_writes_quiesced(self, compose):
        compose.return_value = subprocess.CompletedProcess([], 0, stdout='db\nbackend\n')
        with self.assertRaisesRegex(ValueError, 'Stop backend'):
            stack.backup(self.root/'env', self.values, 7)
        self.assertEqual(len(list(self.root.glob('*.dump'))), 0)

    def test_retention_is_project_scoped_and_integrity_checked(self):
        for name in ['yaiku-own-test-001.dump', 'yaiku-own-test-002.dump', 'another-project.dump']:
            dump = self.root/name;dump.write_bytes(name.encode())
            stack.write_manifest(dump, 'yaiku-own-test' if name.startswith('yaiku') else 'another', 'own')
        stack.retain(self.root, 'yaiku-own-test', 1)
        self.assertFalse((self.root/'yaiku-own-test-001.dump').exists())
        self.assertTrue((self.root/'yaiku-own-test-002.dump').exists())
        self.assertTrue((self.root/'another-project.dump').exists())


if __name__ == '__main__':
    unittest.main()
