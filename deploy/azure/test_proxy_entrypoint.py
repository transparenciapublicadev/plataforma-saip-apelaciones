"""Opt-in Docker tests of the built proxy; no pulls, network access or host secrets."""
import os
import subprocess
import unittest


@unittest.skipUnless(os.environ.get('RUN_PROXY_IMAGE_TESTS') == 'true', 'Explicit local image opt-in required')
class ProxyImageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.image = os.environ['PROXY_TEST_IMAGE']
        if not cls.image.startswith('yaiku-local-proxy:'):
            raise ValueError('Use an explicitly built own proxy test image')
        endpoint = subprocess.run(['docker', 'context', 'inspect', 'desktop-linux', '--format',
                                   '{{.Endpoints.docker.Host}}'], check=True, capture_output=True,
                                  text=True, timeout=25).stdout.strip()
        if not endpoint.startswith(('npipe://', 'unix://')):
            raise ValueError('Only a local Docker endpoint is allowed')

    def run_image(self, origin=None, command=None):
        args = ['docker', '--context', 'desktop-linux', 'run', '--rm', '--pull=never',
                '--network', 'none', '--read-only', '--memory', '64m', '--cap-drop', 'ALL',
                '--tmpfs', '/tmp:size=4m,mode=1777', '--label', 'yaiku.proxy-entrypoint-test=true']
        if origin is not None:
            args += ['-e', 'PUBLIC_ORIGIN=' + origin]
        return subprocess.run([*args, self.image, *(command or ['cat', '/tmp/yaiku-nginx.conf'])],
                              capture_output=True, text=True, timeout=25)

    def test_only_exact_configured_host_is_rendered_without_a_port(self):
        for origin, host in [('https://Yaiku.test:9443/', 'Yaiku.test'),
                             ('https://127.0.0.1', '127.0.0.1'), ('https://[::1]:9443', '[::1]')]:
            with self.subTest(origin=origin):
                result = self.run_image(origin)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('"' + host + '" 1;', result.stdout)
                self.assertNotIn('@YAIKU_PUBLIC_HOST@', result.stdout)

    def test_origin_is_required(self):
        result = self.run_image()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('PUBLIC_ORIGIN', result.stderr)

    def test_unsafe_origins_are_rejected_before_any_command_runs(self):
        for origin in ['http://yaiku.test', 'https://*.yaiku.test', 'https://u:p@yaiku.test',
                       'https://yaiku.test/path', 'https://yaiku.test?x=1',
                       'https://yaiku.test\nmalicious', 'https://yaiku.test:99999']:
            with self.subTest(origin=origin):
                result = self.run_image(origin, ['echo', 'COMMAND_RAN'])
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('PUBLIC_ORIGIN', result.stderr)
                self.assertNotIn('COMMAND_RAN', result.stdout)

    def test_default_nginx_config_resolves_to_the_generated_runtime_file(self):
        result = self.run_image('https://yaiku.test', ['readlink', '/etc/nginx/nginx.conf'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), '/tmp/yaiku-nginx.conf')


if __name__ == '__main__':
    unittest.main()
