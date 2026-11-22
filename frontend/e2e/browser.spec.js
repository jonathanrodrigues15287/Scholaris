const { test, expect } = require('@playwright/test');

const password = 'Browser1!Secure';

async function register(page, suffix) {
  await page.addInitScript(() => {
    localStorage.setItem('scholaris_api_base', 'http://127.0.0.1:8000/api/v1');
  });
  await page.goto('/');
  await page.click('[data-target="accounts"]');
  await expect(page.locator('#accounts')).toBeVisible();
  await page.fill('#api-auth-email', `browser-${suffix}@example.com`);
  await page.fill('#api-auth-username', `browser_${suffix}`);
  await page.fill('#api-auth-password', password);
  await page.click('#api-register-btn');
  await expect(page.locator('#api-auth-status')).toContainText(`Connected as browser-${suffix}@example.com`);
}

async function openAssignments(page) {
  await page.click('[data-target="assignments"]');
  await expect(page.locator('#assignments')).toBeVisible();
}

test('real registration creates auth cookies and CSRF-protected mutations', async ({ page, context }) => {
  await register(page, 'csrf');

  const cookies = await context.cookies();
  expect(cookies.some(cookie => cookie.name === 'access_token')).toBeTruthy();
  expect(cookies.some(cookie => cookie.name === 'refresh_token')).toBeTruthy();
  expect(cookies.some(cookie => cookie.name === 'csrf_token')).toBeTruthy();

  await openAssignments(page);
  let mutatingRequest;
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/assignments')) {
      mutatingRequest = request;
    }
  });
  await page.fill('#assignment-title', 'Browser CSRF assignment');
  await page.click('#add-assignment-btn');

  await expect(page.locator('#assignments-list')).toContainText('Browser CSRF assignment');
  await expect.poll(() => mutatingRequest?.headers()['x-csrf-token'] || '').not.toBe('');
});

test('offline assignment creation is queued and replayed after reconnect', async ({ page, context }) => {
  await register(page, 'offline');
  await openAssignments(page);

  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.route('**/api/v1/assignments', route => {
    if (route.request().method() === 'POST') {
      return route.abort('internetdisconnected');
    }
    return route.continue();
  });
  await page.fill('#assignment-title', 'Offline browser assignment');
  await page.click('#add-assignment-btn');

  await expect(page.locator('#assignments-list')).toContainText('Offline browser assignment');
  await expect.poll(() => page.evaluate(() => ({
    onLine: navigator.onLine,
    authenticated: window.ScholarisApi?.isAuthenticated(),
    queue: JSON.parse(localStorage.getItem('scholaris_sync_queue') || '[]').length
  })), { timeout: 10_000 }).toMatchObject({
    onLine: false,
    authenticated: true
  });
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('scholaris_sync_queue') || '[]').length
  )).toBeGreaterThan(0);

  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await page.unroute('**/api/v1/assignments');
  await page.evaluate(() => window.ScholarisApi.flushSyncQueue());
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('scholaris_sync_queue') || '[]').length
  )).toBe(0);
  await expect(page.locator('#assignments-list')).toContainText('Offline browser assignment');

  const response = await context.request.get('http://127.0.0.1:8000/api/v1/assignments');
  expect(response.ok()).toBeTruthy();
});

test('a second tab shares the browser session and CSRF cookies', async ({ page, context }) => {
  await register(page, 'tabs');
  const second = await context.newPage();
  await second.addInitScript(() => {
    localStorage.setItem('scholaris_api_base', 'http://127.0.0.1:8000/api/v1');
  });
  await second.goto('/');

  await expect(second.locator('#api-auth-status')).toContainText('Backend connected');
  await second.click('[data-target="accounts"]');
  await expect(second.locator('#api-logout-btn')).toBeVisible();

  const [firstCookies, secondCookies] = await Promise.all([
    context.cookies(),
    context.cookies()
  ]);
  expect(firstCookies.some(cookie => cookie.name === 'access_token')).toBeTruthy();
  expect(secondCookies.some(cookie => cookie.name === 'csrf_token')).toBeTruthy();
});
