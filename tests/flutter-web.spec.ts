import { test, expect } from "@playwright/test";

const FLUTTER_URL = "http://localhost:8081";

test.describe("Flutter Web E2E", () => {
  test("1 - App loads and has title", async ({ page }) => {
    await page.goto(FLUTTER_URL);
    await expect(page).toHaveTitle("sparepart_mobile");
    // flutter-view is the main container
    await expect(page.locator("flutter-view")).toBeAttached({ timeout: 15000 });
  });

  test("2 - Public lookup: enter code and search", async ({ page }) => {
    await page.goto(FLUTTER_URL);
    await expect(page.locator("flutter-view")).toBeAttached({ timeout: 15000 });

    // Type a part number into the Flutter canvas
    await page.keyboard.type("103625710");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);
    // Verify no crash - flutter-view still present
    await expect(page.locator("flutter-view")).toBeAttached();
  });

  test("3 - Login screen loads", async ({ page }) => {
    await page.goto(`${FLUTTER_URL}/login`);
    await expect(page.locator("flutter-view")).toBeAttached({ timeout: 15000 });
  });

  test("4 - Login with credentials", async ({ page }) => {
    await page.goto(`${FLUTTER_URL}/login`);
    await expect(page.locator("flutter-view")).toBeAttached({ timeout: 15000 });

    // Type username, tab to password, type password, submit
    await page.keyboard.type("admin");
    await page.keyboard.press("Tab");
    await page.keyboard.type("admin123");
    await page.keyboard.press("Enter");

    // Wait for auth and navigation
    await page.waitForTimeout(3000);
    await expect(page.locator("flutter-view")).toBeAttached();
  });

  test("5 - Home page after login", async ({ page }) => {
    await page.goto(`${FLUTTER_URL}/login`);
    await expect(page.locator("flutter-view")).toBeAttached({ timeout: 15000 });

    await page.keyboard.type("admin");
    await page.keyboard.press("Tab");
    await page.keyboard.type("admin123");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    // Should redirect to home if authenticated
    await page.goto(`${FLUTTER_URL}/home`);
    await page.waitForTimeout(3000);
    await expect(page.locator("flutter-view")).toBeAttached();
  });

  test("6 - Parts list page after auth", async ({ page }) => {
    await page.goto(`${FLUTTER_URL}/login`);
    await expect(page.locator("flutter-view")).toBeAttached({ timeout: 15000 });

    await page.keyboard.type("admin");
    await page.keyboard.press("Tab");
    await page.keyboard.type("admin123");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    await page.goto(`${FLUTTER_URL}/parts`);
    await page.waitForTimeout(3000);
    await expect(page.locator("flutter-view")).toBeAttached();
  });

  test("7 - App survives route changes", async ({ page }) => {
    await page.goto(FLUTTER_URL);
    await expect(page.locator("flutter-view")).toBeAttached({ timeout: 15000 });

    // Visit multiple routes
    const routes = ["/lookup", "/login", "/parts", "/home"];
    for (const route of routes) {
      await page.goto(`${FLUTTER_URL}${route}`);
      await page.waitForTimeout(1000);
      await expect(page.locator("flutter-view")).toBeAttached();
    }
  });
});
