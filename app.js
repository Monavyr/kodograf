/* Кодограф: клиентский генератор, без сетевых запросов и серверной обработки. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const formatExamples = {
    CODE128: ["CODE128-2026", "Code 128: латинские буквы, цифры и обычные символы."],
    EAN13: ["590123412345", "EAN-13: 12 цифр; контрольная цифра добавляется автоматически."],
    EAN8: ["9638507", "EAN-8: 7 цифр; контрольная цифра добавляется автоматически."],
    UPC: ["01234567890", "UPC-A: 11 цифр; контрольная цифра добавляется автоматически."],
    CODE39: ["ABC-123", "Code 39: заглавные латинские буквы, цифры и несколько знаков."],
    ITF14: ["1540014128876", "ITF-14: 13 цифр; контрольная цифра добавляется автоматически."],
  };

  let mode = "qr";
  let valid = false;
  let renderSequence = 0;
  let timer;

  function setMode(next) {
    mode = next;
    const qr = next === "qr";
    $("mode-qr").classList.toggle("active", qr);
    $("mode-barcode").classList.toggle("active", !qr);
    $("mode-qr").setAttribute("aria-pressed", String(qr));
    $("mode-barcode").setAttribute("aria-pressed", String(!qr));
    $("qr-fields").hidden = !qr;
    $("barcode-fields").hidden = qr;
    scheduleRender();
  }

  function setQRKind() {
    const kind = $("qr-kind").value;
    $("qr-text-fields").hidden = kind !== "text";
    $("qr-wifi-fields").hidden = kind !== "wifi";
    $("qr-contact-fields").hidden = kind !== "email" && kind !== "phone";
    if (kind === "email") {
      $("qr-contact-label").textContent = "Адрес электронной почты";
      $("qr-contact").placeholder = "name@example.com";
    } else if (kind === "phone") {
      $("qr-contact-label").textContent = "Номер телефона";
      $("qr-contact").placeholder = "+7 900 000-00-00";
    }
    scheduleRender();
  }

  function numberInRange(id, min, max, label) {
    const value = Number($(id).value);
    if (!Number.isFinite(value) || value < min || value > max || $(id).value.trim() === "") {
      throw new Error(`${label}: укажите число от ${min} до ${max}.`);
    }
    return value;
  }

  function wifiEscape(value) {
    return value.replace(/[\\;,:"\n\r]/g, (char) => `\\${char}`);
  }

  function qrPayload() {
    const kind = $("qr-kind").value;
    if (kind === "text") {
      const value = $("qr-text").value.trim();
      if (!value) throw new Error("Введите текст или ссылку для QR-кода.");
      return value;
    }
    if (kind === "wifi") {
      const ssid = $("wifi-ssid").value;
      const security = $("wifi-security").value;
      const password = $("wifi-password").value;
      if (!ssid.trim()) throw new Error("Введите название сети Wi-Fi.");
      if (security !== "nopass" && !password) throw new Error("Введите пароль сети Wi-Fi.");
      return `WIFI:T:${security};S:${wifiEscape(ssid)};P:${security === "nopass" ? "" : wifiEscape(password)};;`;
    }
    const contact = $("qr-contact").value.trim();
    if (kind === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new Error("Введите корректный адрес электронной почты.");
      return `mailto:${contact}`;
    }
    const phone = contact.replace(/[\s()\-]/g, "");
    if (!/^\+?[0-9]{5,20}$/.test(phone)) throw new Error("Введите номер телефона цифрами, при необходимости с +.");
    return `tel:${phone}`;
  }

  function colors() {
    const dark = $("foreground").value;
    const light = $("background").value;
    const transparent = $("transparent").checked;
    if (dark.toLowerCase() === light.toLowerCase() && !transparent) {
      throw new Error("Цвет кода и фона должны отличаться.");
    }
    return { dark, light, transparent };
  }

  function barcodeOptions() {
    const { dark, light, transparent } = colors();
    return {
      format: $("barcode-format").value,
      lineColor: dark,
      background: transparent ? "transparent" : light,
      width: numberInRange("bar-width", 1, 5, "Ширина штриха"),
      height: numberInRange("bar-height", 40, 240, "Высота штрихов"),
      margin: 12,
      displayValue: $("show-label").checked,
      font: "monospace",
      fontSize: 17,
    };
  }

  function qrOptions() {
    const { dark, light, transparent } = colors();
    return {
      width: numberInRange("qr-size", 160, 1200, "Размер файла"),
      margin: 4,
      errorCorrectionLevel: $("qr-error").value,
      color: { dark: `${dark}ff`, light: transparent ? `${light}00` : `${light}ff` },
    };
  }

  function showError(message) {
    valid = false;
    $("preview").replaceChildren();
    $("error").textContent = message;
    $("error").hidden = false;
    $("status").textContent = "Исправьте данные для генерации";
    $("download-png").disabled = true;
    $("download-svg").disabled = true;
  }

  function showSuccess() {
    valid = true;
    $("error").hidden = true;
    $("error").textContent = "";
    $("status").textContent = "Код готов к скачиванию";
    $("download-png").disabled = false;
    $("download-svg").disabled = false;
  }

  function errorMessage(error) {
    if (error instanceof Error) return error.message;
    if (mode === "barcode") {
      return `Неверное значение для ${$("barcode-format").value}. ${$("barcode-hint").textContent}`;
    }
    return "Не удалось создать код. Проверьте введённые данные.";
  }

  async function render() {
    const seq = ++renderSequence;
    $("preview").classList.toggle("transparent-preview", $("transparent").checked);
    $("background").disabled = $("transparent").checked;
    $("transparent-hint").hidden = !$("transparent").checked;
    $("foreground-hex").textContent = $("foreground").value.toUpperCase();
    $("background-hex").textContent = $("background").value.toUpperCase();
    try {
      if (mode === "barcode") {
        const value = $("barcode-value").value;
        if (!value) throw new Error("Введите значение для штрихкода.");
        if (/[\u007f-\uffff\n\r\t]/.test(value)) throw new Error("Для штрихкода используйте латинские буквы, цифры и обычные символы. Русский текст можно записать в QR-код.");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        JsBarcode(svg, value, barcodeOptions());
        svg.setAttribute("aria-hidden", "true");
        if (seq !== renderSequence) return;
        $("preview").replaceChildren(svg);
      } else {
        const payload = qrPayload();
        const canvas = document.createElement("canvas");
        await QRCode.toCanvas(canvas, payload, qrOptions());
        if (seq !== renderSequence) return;
        canvas.setAttribute("aria-hidden", "true");
        $("preview").replaceChildren(canvas);
      }
      showSuccess();
    } catch (error) {
      if (seq === renderSequence) showError(errorMessage(error));
    }
  }

  function scheduleRender() {
    clearTimeout(timer);
    valid = false;
    $("download-png").disabled = true;
    $("download-svg").disabled = true;
    timer = setTimeout(render, 160);
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось сохранить PNG.")), "image/png");
    });
  }

  async function barcodePNG(svg) {
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Не удалось преобразовать SVG в PNG.")); image.src = url; });
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(image.width * scale);
      canvas.height = Math.ceil(image.height * scale);
      if (canvas.width > 16000 || canvas.height > 16000) throw new Error("Изображение слишком большое для PNG. Скачайте SVG.");
      const context = canvas.getContext("2d");
      context.scale(scale, scale);
      context.drawImage(image, 0, 0);
      return canvasBlob(canvas);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function download(type) {
    if (!valid) return;
    const name = mode === "qr" ? "qr-code" : `${$("barcode-format").value.toLowerCase()}-barcode`;
    try {
      let blob;
      if (mode === "qr") {
        const payload = qrPayload();
        const options = qrOptions();
        if (type === "svg") {
          const svg = await QRCode.toString(payload, { ...options, type: "svg" });
          blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        } else {
          const canvas = document.createElement("canvas");
          await QRCode.toCanvas(canvas, payload, options);
          blob = await canvasBlob(canvas);
        }
      } else {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        JsBarcode(svg, $("barcode-value").value, barcodeOptions());
        if (type === "svg") {
          blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
        } else {
          blob = await barcodePNG(svg);
        }
      }
      saveBlob(blob, `${name}.${type}`);
    } catch (error) {
      showError(errorMessage(error));
    }
  }

  $("mode-qr").addEventListener("click", () => setMode("qr"));
  $("mode-barcode").addEventListener("click", () => setMode("barcode"));
  $("qr-kind").addEventListener("change", setQRKind);
  $("barcode-format").addEventListener("change", () => {
    const [example, hint] = formatExamples[$("barcode-format").value];
    if (Object.values(formatExamples).some(([old]) => old === $("barcode-value").value)) $("barcode-value").value = example;
    $("barcode-hint").textContent = hint;
    scheduleRender();
  });
  $("wifi-show-password").addEventListener("change", () => { $("wifi-password").type = $("wifi-show-password").checked ? "text" : "password"; });
  $("wifi-security").addEventListener("change", () => { $("wifi-password").disabled = $("wifi-security").value === "nopass"; });
  $("generator-form").addEventListener("input", scheduleRender);
  $("generator-form").addEventListener("change", scheduleRender);
  $("generator-form").addEventListener("submit", (event) => event.preventDefault());
  $("download-png").addEventListener("click", () => download("png"));
  $("download-svg").addEventListener("click", () => download("svg"));
  render();
})();
