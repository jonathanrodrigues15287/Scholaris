const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './frontend/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5500',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'python scripts/browser_e2e_server.py',
      cwd: 'backend',
      url: 'http://127.0.0.1:8000/api/v1/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: 'sqlite:///./browser_e2e.db',
        JWT_SECRET_KEY: 'browser-e2e-secret-key-with-at-least-32-characters',
        APP_ENV: 'test',
        DEBUG: 'false',
        CORS_ORIGINS: '["http://127.0.0.1:5500","http://localhost:5500"]'
      }
    },
    {
      command: 'python -m http.server 5500 --bind 127.0.0.1 --directory frontend',
      url: 'http://127.0.0.1:5500',
      reuseExistingServer: false,
      timeout: 30_000
    }
  ]
});
