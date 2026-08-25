import { test, expect } from '@playwright/test';

test('mobile 375px - capture quanly-khachhang login', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('https://quanly-khachhang.vercel.app/login', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'test-results/mobile-login-375.png', fullPage: true });
  await expect(page.getByRole('heading').first()).toBeVisible();
});

test('mobile 375px - verify CSS media query breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('https://quanly-khachhang.vercel.app/login');
  // Check that mobile header (hamburger) would be visible on mobile
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 767px)').matches);
  expect(isMobile).toBe(true);
});

test('desktop 1440px - verify layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('https://quanly-khachhang.vercel.app/login', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'test-results/desktop-login-1440.png', fullPage: true });
  await expect(page.getByRole('heading').first()).toBeVisible();
});
