/* Кодограф: клиентский генератор, без сетевых запросов и серверной обработки. */
import { wifiEscape, normalizePhone, vcardEscape, isValidEmail, hexToHSV, hsvToHex } from "./core.js";

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
  // Set once localStorage has been restored (or found empty) for this page
  // load. Saves are blocked before that moment so the debounced initial render
  // can never overwrite stored settings with form defaults.
  let settingsLoaded = false;
  let activeColor = null;
  let pickerHSV = { h: 0, s: 0, v: 0 };

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
    // Toggle field visibility directly here (instead of relying on the form's
    // change listener) so updates also apply while restoring saved settings.
    $("qr-text-fields").hidden = kind !== "text";
    $("qr-wifi-fields").hidden = kind !== "wifi";
    $("qr-contact-fields").hidden = kind !== "email" && kind !== "phone";
    $("qr-sms-fields").hidden = kind !== "sms";
    $("qr-geo-fields").hidden = kind !== "geo";
    $("qr-vcard-fields").hidden = kind !== "vcard";
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
    if (kind === "sms") {
      const smsPhone = normalizePhone($("sms-phone").value);
      if (!smsPhone) throw new Error("Введите корректный номер телефона для SMS: цифры и при необходимости +.");
      const body = $("sms-body").value.trim();
      return body ? `SMSTO:${smsPhone}:${encodeURIComponent(body)}` : `SMSTO:${smsPhone}:`;
    }
    if (kind === "geo") {
      const lat = Number($("geo-lat").value.replace(",", "."));
      const lon = Number($("geo-lon").value.replace(",", "."));
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("Широта должна быть числом от -90 до 90.");
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error("Долгота должна быть числом от -180 до 180.");
      return `geo:${lat.toFixed(6)},${lon.toFixed(6)}`;
    }
    if (kind === "vcard") {
      const fullName = $("vcard-name").value.trim();
      const phone = $("vcard-phone").value.trim();
      const email = $("vcard-email").value.trim();
      const org = $("vcard-org").value.trim();
      const title = $("vcard-title").value.trim();
      const url = $("vcard-url").value.trim();
      if (!fullName && !phone && !email && !org) throw new Error("Заполните хотя бы имя, телефон, почту или организацию.");
      if (email && !isValidEmail(email)) throw new Error("В контакте указан некорректный адрес электронной почты.");
      const parts = fullName.split(/\s+/);
      const last = parts.length > 1 ? parts.shift() : "";
      const first = parts.join(" ");
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      lines.push(`N:${vcardEscape(last)};${vcardEscape(first)};;;`);
      lines.push(`FN:${vcardEscape(fullName || first || last)}`);
      if (org) lines.push(`ORG:${vcardEscape(org)}`);
      if (title) lines.push(`TITLE:${vcardEscape(title)}`);
      if (phone) {
        const vcardTel = normalizePhone(phone);
        if (!vcardTel) throw new Error("В контакте указан некорректный номер телефона.");
        lines.push(`TEL;TYPE=CELL:${vcardTel}`);
      }
      if (email) lines.push(`EMAIL:${email}`);
      if (url) lines.push(`URL:${url}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
    const contact = $("qr-contact").value.trim();
    if (kind === "email") {
      if (!isValidEmail(contact)) throw new Error("Введите корректный адрес электронной почты.");
      return `mailto:${contact}`;
    }
    const telPhone = normalizePhone(contact);
    if (!telPhone) throw new Error("Введите номер телефона цифрами, при необходимости с +.");
    return `tel:${telPhone}`;
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

  function syncColorControls() {
    const foreground = $("foreground").value.toUpperCase();
    const background = $("background").value.toUpperCase();
    const transparent = $("transparent").checked;
    $("foreground-hex").textContent = foreground;
    $("background-hex").textContent = background;
    $("foreground-swatch").style.backgroundColor = foreground;
    $("background-swatch").style.backgroundColor = background;
    for (const option of document.querySelectorAll(".palette-option")) {
      const selected = !transparent && option.dataset.foreground.toUpperCase() === foreground && option.dataset.background.toUpperCase() === background;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    }
  }



  function updatePickerUI() {
    $("picker-plane").style.setProperty("--picker-hue", `${pickerHSV.h}`);
    $("picker-cursor").style.left = `${pickerHSV.s * 100}%`;
    $("picker-cursor").style.top = `${(1 - pickerHSV.v) * 100}%`;
    $("picker-hue").value = String(Math.round(pickerHSV.h));
    $("picker-hex").value = $(activeColor).value.toUpperCase();
    $("picker-plane").setAttribute("aria-valuenow", String(Math.round(pickerHSV.s * 100)));
    $("picker-plane").setAttribute("aria-valuetext", `Насыщенность ${Math.round(pickerHSV.s * 100)}%, яркость ${Math.round(pickerHSV.v * 100)}%`);
  }

  function setPickerColor() {
    $(activeColor).value = hsvToHex(pickerHSV);
    updatePickerUI();
    syncColorControls();
    scheduleRender();
  }

  function closeColorPicker(returnFocus = false) {
    if (!activeColor) return;
    const previous = activeColor;
    $("color-picker").hidden = true;
    $(`${previous}-button`).setAttribute("aria-expanded", "false");
    activeColor = null;
    if (returnFocus) $(`${previous}-button`).focus();
  }

  function openColorPicker(target) {
    if (activeColor === target) { closeColorPicker(true); return; }
    closeColorPicker();
    activeColor = target;
    pickerHSV = hexToHSV($(target).value);
    $("picker-title").textContent = target === "foreground" ? "Цвет кода" : "Цвет фона";
    $("color-picker").hidden = false;
    $(`${target}-button`).setAttribute("aria-expanded", "true");
    updatePickerUI();
    $("picker-plane").focus();
  }

  function applyQRPreviewSize(canvas) {
    if (!canvas) return;
    const stage = document.querySelector(".preview-stage");
    const outer = getComputedStyle(stage), inner = getComputedStyle($("preview"));
    const available = stage.clientWidth - parseFloat(outer.paddingLeft) - parseFloat(outer.paddingRight) - parseFloat(inner.paddingLeft) - parseFloat(inner.paddingRight) - 2;
    const maximum = Math.min(360, Math.max(120, available));
    const progress = Math.max(0, Math.min(1, (canvas.width - 160) / 1040));
    canvas.style.width = `${Math.round(maximum * (0.4 + 0.6 * Math.sqrt(progress)))}px`;
    canvas.style.height = "auto";
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
    $("copy-image").disabled = true;
    $("copy-payload").disabled = true;
  }

  function showSuccess() {
    valid = true;
    $("error").hidden = true;
    $("error").textContent = "";
    $("status").textContent = "Код готов к скачиванию";
    $("download-png").disabled = false;
    $("download-svg").disabled = false;
    $("copy-image").disabled = false;
    $("copy-payload").disabled = false;
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
    $("background-button").disabled = $("transparent").checked;
    if ($("transparent").checked && activeColor === "background") closeColorPicker();
    $("transparent-hint").hidden = !$("transparent").checked;
    $("qr-size-note").textContent = `${$("qr-size").value || "—"} × ${$("qr-size").value || "—"} px`;
    syncColorControls();
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
        // The library sets both dimensions inline. Keep a square preview that reflects the selected size.
        applyQRPreviewSize(canvas);
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
    timer = setTimeout(() => {
      // Save synchronously *before* the async render starts: if a reload
      // interrupts rendering, storage already holds the current form state.
      saveSettings();
      render();
    }, 160);
  }

  // --- Settings persistence (localStorage, best-effort) ---
  const SETTINGS_KEY = "kodograf-settings-v1";
  // Read synchronously in <head>, before any save can happen: this is the
  // snapshot we are allowed to restore. Captured early on purpose — later
  // reads could observe values already overwritten by a pagehide flush of
  // the *previous* page instance racing with this load.
  let storedSettingsRaw = null;
  try {
    storedSettingsRaw = localStorage.getItem(SETTINGS_KEY);
  } catch {
    /* storage unavailable in private mode; persistence is optional */
  }
  const SETTING_IDS = [
    "qr-kind", "qr-text", "wifi-ssid", "wifi-security", "qr-size", "qr-error",
    "sms-phone", "sms-body", "geo-lat", "geo-lon", "vcard-name", "vcard-phone",
    "vcard-email", "vcard-org", "vcard-title", "vcard-url", "barcode-format",
    "barcode-value", "bar-width", "bar-height", "foreground", "background",
  ];

  function saveSettings() {
    if (!settingsLoaded) return;
    try {
      const data = { mode };
      for (const id of SETTING_IDS) {
        const el = $(id);
        if (el) data[id] = el.value;
      }
      data.transparent = $("transparent").checked;
      data.showLabel = $("show-label").checked;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    } catch {
      // Storage can be unavailable in private mode; settings persistence is optional.
    }
  }

  function restoreSettings() {
    let data = null;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") data = parsed;
      }
    } catch {
      // Corrupt or unavailable storage: start from defaults.
    }
    if (data) {
      for (const id of SETTING_IDS) {
        const el = $(id);
        if (el && typeof data[id] === "string") el.value = data[id];
      }
      if (typeof data.transparent === "boolean") $("transparent").checked = data.transparent;
      if (typeof data.showLabel === "boolean") $("show-label").checked = data.showLabel;
    }
    setQRKind();
    const formatHint = formatExamples[$("barcode-format").value];
    if (formatHint) $("barcode-hint").textContent = formatHint[1];
    // setMode() updates the UI and schedules a render; it also sets `mode`.
    if (data && (data.mode === "barcode" || data.mode === "qr")) setMode(data.mode);
    settingsLoaded = true;
  }

  // --- Clipboard helpers ---
  let statusTimer;
  function flashStatus(message) {
    $("status").textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      if (valid) $("status").textContent = "Код готов к скачиванию";
    }, 2200);
  }

  async function copyPayload() {
    if (!valid) return;
    try {
      const text = mode === "barcode" ? $("barcode-value").value : qrPayload();
      await navigator.clipboard.writeText(text);
      flashStatus("Данные скопированы в буфер обмена");
    } catch {
      flashStatus("Не удалось скопировать данные");
    }
  }

  async function copyImage() {
    if (!valid) return;
    try {
      let blob;
      if (mode === "qr") {
        const canvas = document.createElement("canvas");
        await QRCode.toCanvas(canvas, qrPayload(), qrOptions());
        blob = await canvasBlob(canvas);
      } else {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        JsBarcode(svg, $("barcode-value").value, barcodeOptions());
        blob = await barcodePNG(svg);
      }
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard || !navigator.clipboard.write) {
        throw new Error("Clipboard image API unavailable");
      }
      const pngBlob = blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      flashStatus("Изображение скопировано в буфер обмена");
    } catch {
      flashStatus("Не удалось скопировать изображение");
    }
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
  for (const option of document.querySelectorAll(".palette-option")) {
    option.addEventListener("click", () => {
      $("foreground").value = option.dataset.foreground;
      $("background").value = option.dataset.background;
      $("transparent").checked = false;
      syncColorControls();
      scheduleRender();
    });
  }
  for (const target of ["foreground", "background"]) {
    $(`${target}-button`).addEventListener("click", () => openColorPicker(target));
  }
  $("picker-close").addEventListener("click", () => closeColorPicker(true));
  $("picker-plane").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    $("picker-plane").setPointerCapture(event.pointerId);
    $("picker-plane").focus();
    const rect = $("picker-plane").getBoundingClientRect();
    pickerHSV.s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    pickerHSV.v = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    setPickerColor();
  });
  $("picker-plane").addEventListener("pointermove", (event) => {
    if (!$("picker-plane").hasPointerCapture(event.pointerId)) return;
    const rect = $("picker-plane").getBoundingClientRect();
    pickerHSV.s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    pickerHSV.v = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    setPickerColor();
  });
  $("picker-plane").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.1 : 0.01;
    if (event.key === "ArrowLeft") pickerHSV.s = Math.max(0, pickerHSV.s - step);
    if (event.key === "ArrowRight") pickerHSV.s = Math.min(1, pickerHSV.s + step);
    if (event.key === "ArrowUp") pickerHSV.v = Math.min(1, pickerHSV.v + step);
    if (event.key === "ArrowDown") pickerHSV.v = Math.max(0, pickerHSV.v - step);
    setPickerColor();
  });
  $("picker-hue").addEventListener("input", () => { pickerHSV.h = Number($("picker-hue").value); setPickerColor(); });
  $("picker-hex").addEventListener("input", () => {
    const hex = $("picker-hex").value.trim();
    if (!/^#?[0-9a-f]{6}$/i.test(hex)) return;
    $(activeColor).value = `#${hex.replace(/^#/, "").toUpperCase()}`;
    pickerHSV = hexToHSV($(activeColor).value);
    updatePickerUI();
    syncColorControls();
    scheduleRender();
  });
  $("picker-hex").addEventListener("blur", () => { if (activeColor) updatePickerUI(); });
  document.addEventListener("pointerdown", (event) => {
    if (activeColor && !$("color-picker").contains(event.target) && !event.target.closest(".color-control")) closeColorPicker();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && activeColor) closeColorPicker(true); });
  window.addEventListener("resize", () => applyQRPreviewSize($("preview").querySelector("canvas")));
  $("qr-kind").addEventListener("change", setQRKind);
  $("barcode-format").addEventListener("change", () => {
    const [example, hint] = formatExamples[$("barcode-format").value];
    if (Object.values(formatExamples).some(([old]) => old === $("barcode-value").value)) $("barcode-value").value = example;
    $("barcode-hint").textContent = hint;
    scheduleRender();
  });
  $("wifi-show-password").addEventListener("change", () => { $("wifi-password").type = $("wifi-show-password").checked ? "text" : "password"; });
  $("wifi-security").addEventListener("change", () => { $("wifi-password").disabled = $("wifi-security").value === "nopass"; });
  $("generator-form").addEventListener("input", (event) => {
    if (event.target.closest("#color-picker")) return;
    scheduleRender();
  });
  $("generator-form").addEventListener("change", (event) => {
    if (event.target.matches("select,input[type=checkbox]")) scheduleRender();
  });
  $("generator-form").addEventListener("submit", (event) => event.preventDefault());
  $("download-png").addEventListener("click", () => download("png"));
  $("download-svg").addEventListener("click", () => download("svg"));
  $("copy-image").addEventListener("click", copyImage);
  $("copy-payload").addEventListener("click", copyPayload);
  restoreSettings();
  scheduleRender();

  // A reload can cut the page off mid-debounce: flush pending changes
  // synchronously while the page is still going away (bfcache-safe).
  window.addEventListener("pagehide", () => {
    if (timer && settingsLoaded) {
      clearTimeout(timer);
      timer = null;
      saveSettings();
    }
  });

  // PWA: register the service worker for offline use (only on https/localhost).
  if ("serviceWorker" in navigator && (window.isSecureContext || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // Offline support is optional; ignore registration failures.
      });
    });
  }
})();
