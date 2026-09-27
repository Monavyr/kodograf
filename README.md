# Кодограф / Kodograf

**QR and barcode generator in your browser · Генератор QR-кодов и штрихкодов в браузере**

[Русский](#ru) · [English](#en)

![Скриншот интерфейса Кодограф / Screenshot of the Kodograf interface](assets/preview.png)

<a id="ru"></a>

## Русский

**Кодограф** создаёт QR-коды и штрихкоды, показывает результат до скачивания и экспортирует его в PNG или SVG. Сайт работает без регистрации и серверной обработки: введённые данные остаются в браузере. Он подходит для публикации на GitHub Pages.

**Сайт:** [monavyr.github.io/kodograf](https://monavyr.github.io/kodograf/)

### Возможности

- QR-коды для текста, ссылок, Wi-Fi, адресов электронной почты и телефонных номеров.
- Штрихкоды Code 128, EAN-13, EAN-8, UPC-A, Code 39 и ITF-14.
- Настройка размера и цветов, прозрачный фон, подпись под штрихкодом и предпросмотр.
- Скачивание PNG или SVG; интерфейс адаптирован для телефона.
- Библиотеки находятся в `vendor/`: для генерации не требуются внешние CDN или API.

### Запуск локально

Откройте `index.html` в браузере. Можно также запустить локальный сервер из корня проекта:

```bash
python -m http.server 8000
```

После этого откройте `http://localhost:8000/`.

### Ограничения

- Штрихкоды в этой версии принимают латинские буквы, цифры и допустимые для выбранного формата символы. Кириллицу можно закодировать в QR-коде.
- EAN и UPC требуют значения установленной длины; контрольная цифра рассчитывается автоматически. Созданное изображение не означает, что товарный номер зарегистрирован.
- Перед печатью проверьте считывание кода в его конечном размере. Для прозрачного фона важна светлая и однородная поверхность.

### Технологии и лицензии

HTML, CSS и JavaScript без серверной части. Генерация штрихкодов: [JsBarcode 3.12.3](https://github.com/lindell/JsBarcode). Генерация QR: [node-qrcode 1.5.4](https://github.com/soldair/node-qrcode), собранный для браузера; зависимость [dijkstrajs](https://github.com/andrewhayward/dijkstra). Тексты лицензий сторонних библиотек находятся в `vendor/licenses/`.

Для исходного кода этого проекта отдельная лицензия пока не указана.

---

<a id="en"></a>

## English

**Kodograf** creates QR codes and barcodes, shows the result before download, and exports it as PNG or SVG. The site works without registration or server-side processing: entered data stays in the browser. It can be published on GitHub Pages.

**Website:** [monavyr.github.io/kodograf](https://monavyr.github.io/kodograf/)

### Features

- QR codes for text, links, Wi-Fi, email addresses, and phone numbers.
- Code 128, EAN-13, EAN-8, UPC-A, Code 39, and ITF-14 barcodes.
- Adjustable size and colors, a transparent background, text below the barcode, and a preview.
- PNG or SVG downloads; the interface is adapted for phones.
- The libraries are in `vendor/`: generating codes requires no external CDN or API.

### Run locally

Open `index.html` in a browser. You can also start a local server from the project root:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

### Limitations

- Barcodes in this version accept Latin letters, digits, and characters allowed by the selected format. Cyrillic can be encoded in a QR code.
- EAN and UPC require values of a specified length; the check digit is calculated automatically. A generated image does not mean that the product number is registered.
- Before printing, check that the code can be scanned at its final size. A transparent background needs a light, even surface.

### Tech and licenses

HTML, CSS, and JavaScript without a server-side component. Barcode generation: [JsBarcode 3.12.3](https://github.com/lindell/JsBarcode). QR generation: [node-qrcode 1.5.4](https://github.com/soldair/node-qrcode), bundled for the browser; dependency: [dijkstrajs](https://github.com/andrewhayward/dijkstra). Third-party library license texts are in `vendor/licenses/`.

No separate license has yet been specified for this project's source code.
