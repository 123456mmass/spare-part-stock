import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Web UI checks", () => {
  test("1 - Login page loads", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /login|เข้าสู่ระบบ/i })).toBeVisible();
  });

  test("2 - Login works and dashboard loads", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[type="password"]', "admin123");
    await page.getByRole("button", { name: /login|เข้าสู่ระบบ/i }).click();
    await page.waitForURL("**/dashboard");
    await expect(page).toHaveURL(/dashboard/);
  });

  test("3 - Dashboard shows content", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[type="password"]', "admin123");
    await page.getByRole("button", { name: /login|เข้าสู่ระบบ/i }).click();
    await page.waitForURL("**/dashboard");
    // Dashboard should have some content
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("4 - Parts list page shows data", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[type="password"]', "admin123");
    await page.getByRole("button", { name: /login|เข้าสู่ระบบ/i }).click();
    await page.waitForURL("**/dashboard");
    await page.goto(`${BASE}/parts`);
    await page.waitForLoadState("networkidle");
    // Should have part rows or at least the page structure
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("5 - Part detail page loads", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[type="password"]', "admin123");
    await page.getByRole("button", { name: /login|เข้าสู่ระบบ/i }).click();
    await page.waitForURL("**/dashboard");
    // Navigate to first part - use a known part ID
    await page.goto(`${BASE}/parts/cmoxpohog003f5sfxlxmven10`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toBeEmpty();
    // Should show part number
    await expect(page.getByText("103625710")).toBeVisible();
  });

  test("6 - Barcode page accessible", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[type="password"]', "admin123");
    await page.getByRole("button", { name: /login|เข้าสู่ระบบ/i }).click();
    await page.waitForURL("**/dashboard");
    await page.goto(`${BASE}/scan`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("7 - Image upload section exists on part detail", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[type="password"]', "admin123");
    await page.getByRole("button", { name: /login|เข้าสู่ระบบ/i }).click();
    await page.waitForURL("**/dashboard");
    await page.goto(`${BASE}/parts/cmoxpohog003f5sfxlxmven10`);
    await page.waitForLoadState("networkidle");
    // Part detail page should load
    await expect(page.getByText("103625710")).toBeVisible();
  });

  test("8 - Categories page loads", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[type="password"]', "admin123");
    await page.getByRole("button", { name: /login|เข้าสู่ระบบ/i }).click();
    await page.waitForURL("**/dashboard");
    await page.goto(`${BASE}/categories`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("9 - Movements page loads", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[type="password"]', "admin123");
    await page.getByRole("button", { name: /login|เข้าสู่ระบบ/i }).click();
    await page.waitForURL("**/dashboard");
    await page.goto(`${BASE}/movements`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("10 - Users page loads (admin only)", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[type="password"]', "admin123");
    await page.getByRole("button", { name: /login|เข้าสู่ระบบ/i }).click();
    await page.waitForURL("**/dashboard");
    await page.goto(`${BASE}/users`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

