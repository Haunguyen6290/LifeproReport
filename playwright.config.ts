import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/playwright',
  timeout: 30000,
  webServer: undefined,
});
