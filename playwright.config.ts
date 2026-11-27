import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  snapshotPathTemplate: '{testDir}/snapshots/{projectName}/{arg}{ext}',
  timeout: 60000,
  expect: {
    toMatchSnapshot: { maxDiffPixelRatio: 0.10 },
  },
  outputDir: 'test-results/visual-parity',
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
  ],
  webServer: [
    {
      command: 'pnpm --dir design-reference dev:local -- --port 5173 --no-open',
      port: 5173,
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'pnpm --dir frontend start',
      port: 4200,
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'Desktop-Light',
      use: {
        viewport: { width: 1280, height: 720 },
        colorScheme: 'light',
        contextOptions: { reducedMotion: 'no-preference' },
      },
    },
    {
      name: 'Desktop-Dark',
      use: {
        viewport: { width: 1280, height: 720 },
        colorScheme: 'dark',
        contextOptions: { reducedMotion: 'no-preference' },
      },
    },
    {
      name: 'Mobile-Light',
      use: {
        viewport: { width: 390, height: 720 },
        colorScheme: 'light',
        contextOptions: { reducedMotion: 'no-preference' },
      },
    },
    {
      name: 'Mobile-Dark',
      use: {
        viewport: { width: 390, height: 720 },
        colorScheme: 'dark',
        contextOptions: { reducedMotion: 'no-preference' },
      },
    },
    {
      name: 'Reduced-Motion',
      use: {
        viewport: { width: 1280, height: 720 },
        colorScheme: 'light',
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],
});
