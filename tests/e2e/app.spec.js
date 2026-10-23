import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8123";

test.describe("Кодограф E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage so localStorage-based settings restore doesn't leak between tests.
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* storage may be unavailable; ignore */
      }
    });
    await page.goto(BASE);
  });

  test("главная страница загружается без ошибок консоли", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await expect(page.locator("#mode-qr")).toBeVisible();
    await expect(page.locator("#status")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("QR-код генерируется для текстового режима", async ({ page }) => {
    await page.fill("#qr-text", "https://example.com");
    await expect(page.locator("#status")).toContainText("готов", { timeout: 5000 });
    await expect(page.locator("#download-png")).toBeEnabled();
    await expect(page.locator("#copy-image")).toBeEnabled();
  });

  test("переключение на SMS валидирует номер телефона", async ({ page }) => {
    await page.selectOption("#qr-kind", "sms");
    await page.fill("#sms-phone", "не телефон");
    await expect(page.locator("#error")).toBeVisible({ timeout: 5000 });
    await page.fill("#sms-phone", "+7 900 000-00-00");
    await expect(page.locator("#status")).toContainText("готов", { timeout: 5000 });
  });

  test("геолокация отклоняет широту вне диапазона", async ({ page }) => {
    await page.selectOption("#qr-kind", "geo");
    await page.fill("#geo-lat", "91");
    await page.fill("#geo-lon", "0");
    await expect(page.locator("#error")).toBeVisible({ timeout: 5000 });
    await page.fill("#geo-lat", "55.7558");
    await expect(page.locator("#status")).toContainText("готов", { timeout: 5000 });
  });

  test("штрихкод Code 128 рендерится", async ({ page }) => {
    await page.click("#mode-barcode");
    await page.fill("#barcode-value", "TEST-123");
    await expect(page.locator("#status")).toContainText("готов", { timeout: 5000 });
  });

  test("настройки сохраняются между перезагрузками", async ({ page }) => {
    await page.selectOption("#qr-kind", "vcard");
    await page.fill("#vcard-name", "Иван Сохранённый");
    await expect(page.locator("#status")).toContainText("готов", { timeout: 5000 });
    // saveSettings runs after the debounced render resolves; wait for localStorage to update
    await expect
      .poll(async () => {
        const raw = await page.evaluate(() => localStorage.getItem("kodograf-settings-v1"));
        return raw ? JSON.parse(raw)["vcard-name"] : null;
      }, { timeout: 5000 })
      .toBe("Иван Сохранённый");

    await page.reload();
    // Guard against a race: if the trailing debounced save from the previous
    // page fires after reload's restore, wait for the form to catch up.
    await expect(page.locator("#vcard-name")).toHaveValue("Иван Сохранённый", { timeout: 5000 });
  });

  test("service worker регистрируется и работает офлайн", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE);
    const registration = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return null;
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      return reg ? reg.active?.scriptURL ?? "registered" : null;
    });
    expect(registration).toBeTruthy();

    // Go offline and reload — app shell should come from cache.
    await context.setOffline(true);
    await page.goto(BASE);
    await expect(page.locator("#mode-qr")).toBeVisible();
    await context.close();
  });

  test("страница отдаёт манифест PWA", async ({ request }) => {
    const response = await request.get(`${BASE}/manifest.webmanifest`);
    expect(response.ok()).toBeTruthy();
    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(Array.isArray(manifest.icons)).toBe(true);
  });
});
