# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.js >> Кодограф E2E >> настройки сохраняются между перезагрузками
- Location: tests/e2e/app.spec.js:56:3

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator:  locator('#vcard-name')
Expected: "Иван Сохранённый"
Received: ""
Timeout:  5000ms

Call log:
  - Expect "toHaveValue" locator('#vcard-name') with timeout 5000ms
  - waiting for locator('#vcard-name')
    14 × locator resolved to <input id="vcard-name" maxlength="120" autocomplete="off" placeholder="Иван Петров"/>
       - unexpected value ""

```

```yaml
- banner:
  - link "Кодограф — на главную":
    - /url: "#top"
    - text: Кодограф
  - text: Работает прямо в браузере
- main:
  - region "Создайте код. Заберите файл.":
    - text: Бесплатный инструмент · без регистрации
    - heading "Создайте код. Заберите файл." [level=1]
    - paragraph: QR-коды и штрихкоды для ссылок, товаров и документов. Настройте вид, проверьте результат и скачайте PNG или SVG.
  - region "Генератор кодов":
    - text: 01 / НАСТРОЙКА
    - heading "Что создаём?" [level=2]
    - group "Тип кода":
      - button "▦ QR-код" [pressed]
      - button "▥ Штрихкод"
    - text: Содержимое QR-кода
    - combobox "Содержимое QR-кода":
      - option "Текст или ссылка" [selected]
      - option "Доступ к Wi-Fi"
      - option "Адрес электронной почты"
      - option "Телефонный номер"
      - option "SMS-сообщение"
      - option "Геолокация"
      - option "Контакт (vCard)"
    - text: Текст или URL
    - textbox "Текст или URL":
      - /placeholder: https://example.com
      - text: https://example.com
    - text: Размер QR, px
    - spinbutton "Размер QR, px": "360"
    - text: Коррекция ошибок
    - combobox "Коррекция ошибок":
      - option "Стандартная · M" [selected]
      - option "Низкая · L"
      - option "Высокая · Q"
      - option "Максимальная · H"
    - paragraph:
      - text: "Файл будет квадратным:"
      - strong: 360 × 360 px
      - text: . Предпросмотр подстраивается под экран.
    - group "Готовые сочетания":
      - text: Готовые сочетания
      - button "Классика" [pressed]
      - button "Лес"
      - button "Синий"
      - button "Бордо"
    - text: Цвет кода
    - button "#101827"
    - text: Фон
    - button "#FFFFFF"
    - checkbox "Прозрачный фон"
    - text: Прозрачный фон 02 / РЕЗУЛЬТАТ
    - heading "Предпросмотр" [level=2]
    - text: ● В реальном времени
    - img "Предпросмотр кода"
    - status: Код готов к скачиванию
    - button "↓ Скачать PNG"
    - button "↓ Скачать SVG"
    - button "⧉ Копировать изображение"
    - button "⎘ Копировать данные"
    - paragraph: Данные остаются в вашем браузере. Сайт не отправляет введённый текст на сервер.
  - region "Подсказки":
    - text: "01"
    - heading "Какой формат выбрать?" [level=3]
    - paragraph: QR-код подходит для ссылок и текста. Code 128 — для произвольных латинских обозначений. EAN и UPC нужны для числовых товарных кодов.
    - text: "02"
    - heading "PNG или SVG?" [level=3]
    - paragraph: PNG удобно вставить в документ. SVG можно масштабировать без потери чёткости и использовать для печати.
    - text: "03"
    - heading "Перед печатью" [level=3]
    - paragraph: Проверьте код камерой или сканером в его конечном размере. Контраст и свободное поле вокруг изображения влияют на считывание.
- contentinfo: Кодограф Генератор для личных и учебных задач
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8123";
  4   | 
  5   | test.describe("Кодограф E2E", () => {
  6   |   test.beforeEach(async ({ page }) => {
  7   |     // Clear storage so localStorage-based settings restore doesn't leak between tests.
  8   |     await page.addInitScript(() => {
  9   |       try {
  10  |         localStorage.clear();
  11  |       } catch {
  12  |         /* storage may be unavailable; ignore */
  13  |       }
  14  |     });
  15  |     await page.goto(BASE);
  16  |   });
  17  | 
  18  |   test("главная страница загружается без ошибок консоли", async ({ page }) => {
  19  |     const errors = [];
  20  |     page.on("pageerror", (e) => errors.push(String(e)));
  21  |     await expect(page.locator("#mode-qr")).toBeVisible();
  22  |     await expect(page.locator("#status")).toBeVisible();
  23  |     expect(errors).toEqual([]);
  24  |   });
  25  | 
  26  |   test("QR-код генерируется для текстового режима", async ({ page }) => {
  27  |     await page.fill("#qr-text", "https://example.com");
  28  |     await expect(page.locator("#status")).toContainText("готов", { timeout: 5000 });
  29  |     await expect(page.locator("#download-png")).toBeEnabled();
  30  |     await expect(page.locator("#copy-image")).toBeEnabled();
  31  |   });
  32  | 
  33  |   test("переключение на SMS валидирует номер телефона", async ({ page }) => {
  34  |     await page.selectOption("#qr-kind", "sms");
  35  |     await page.fill("#sms-phone", "не телефон");
  36  |     await expect(page.locator("#error")).toBeVisible({ timeout: 5000 });
  37  |     await page.fill("#sms-phone", "+7 900 000-00-00");
  38  |     await expect(page.locator("#status")).toContainText("готов", { timeout: 5000 });
  39  |   });
  40  | 
  41  |   test("геолокация отклоняет широту вне диапазона", async ({ page }) => {
  42  |     await page.selectOption("#qr-kind", "geo");
  43  |     await page.fill("#geo-lat", "91");
  44  |     await page.fill("#geo-lon", "0");
  45  |     await expect(page.locator("#error")).toBeVisible({ timeout: 5000 });
  46  |     await page.fill("#geo-lat", "55.7558");
  47  |     await expect(page.locator("#status")).toContainText("готов", { timeout: 5000 });
  48  |   });
  49  | 
  50  |   test("штрихкод Code 128 рендерится", async ({ page }) => {
  51  |     await page.click("#mode-barcode");
  52  |     await page.fill("#barcode-value", "TEST-123");
  53  |     await expect(page.locator("#status")).toContainText("готов", { timeout: 5000 });
  54  |   });
  55  | 
  56  |   test("настройки сохраняются между перезагрузками", async ({ page }) => {
  57  |     await page.selectOption("#qr-kind", "vcard");
  58  |     await page.fill("#vcard-name", "Иван Сохранённый");
  59  |     await expect(page.locator("#status")).toContainText("готов", { timeout: 5000 });
  60  |     // saveSettings runs after the debounced render resolves; wait for localStorage to update
  61  |     await expect
  62  |       .poll(async () => {
  63  |         const raw = await page.evaluate(() => localStorage.getItem("kodograf-settings-v1"));
  64  |         return raw ? JSON.parse(raw)["vcard-name"] : null;
  65  |       }, { timeout: 5000 })
  66  |       .toBe("Иван Сохранённый");
  67  | 
  68  |     await page.reload();
  69  |     // Guard against a race: if the trailing debounced save from the previous
  70  |     // page fires after reload's restore, wait for the form to catch up.
> 71  |     await expect(page.locator("#vcard-name")).toHaveValue("Иван Сохранённый", { timeout: 5000 });
      |                                               ^ Error: expect(locator).toHaveValue(expected) failed
  72  |   });
  73  | 
  74  |   test("service worker регистрируется и работает офлайн", async ({ browser }) => {
  75  |     const context = await browser.newContext();
  76  |     const page = await context.newPage();
  77  |     await page.goto(BASE);
  78  |     const registration = await page.evaluate(async () => {
  79  |       if (!("serviceWorker" in navigator)) return null;
  80  |       const reg = await navigator.serviceWorker.ready.catch(() => null);
  81  |       return reg ? reg.active?.scriptURL ?? "registered" : null;
  82  |     });
  83  |     expect(registration).toBeTruthy();
  84  | 
  85  |     // Go offline and reload — app shell should come from cache.
  86  |     await context.setOffline(true);
  87  |     await page.goto(BASE);
  88  |     await expect(page.locator("#mode-qr")).toBeVisible();
  89  |     await context.close();
  90  |   });
  91  | 
  92  |   test("страница отдаёт манифест PWA", async ({ request }) => {
  93  |     const response = await request.get(`${BASE}/manifest.webmanifest`);
  94  |     expect(response.ok()).toBeTruthy();
  95  |     const manifest = await response.json();
  96  |     expect(manifest.name).toBeTruthy();
  97  |     expect(Array.isArray(manifest.icons)).toBe(true);
  98  |   });
  99  | });
  100 | 
```