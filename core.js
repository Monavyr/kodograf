/* Кодограф: чистые функции-помощники. Используются app.js и unit-тестами.
 * Модуль не трогает DOM и не делает сетевых запросов. */

export function wifiEscape(value) {
  return value.replace(/[\\;:"\n\r]/g, (char) => `\\${char}`);
}

export function vcardEscape(value) {
  return value.replace(/([\\,;.])/g, "\\$1").replace(/\n/g, "\\n");
}

export function normalizePhone(raw) {
  const phone = String(raw).replace(/[\s()-]/g, "");
  if (!/^\+?[0-9]{5,20}$/.test(phone)) return null;
  return phone;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export function wifiPayload({ ssid, password, security }) {
  if (!String(ssid).trim()) throw new Error("Введите название сети Wi-Fi.");
  if (security !== "nopass" && !password) throw new Error("Введите пароль сети Wi-Fi.");
  return `WIFI:T:${security};S:${wifiEscape(ssid)};P:${security === "nopass" ? "" : wifiEscape(password)};;`;
}

export function smsPayload({ phone, body }) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error("Введите корректный номер телефона для SMS.");
  const text = String(body || "").trim();
  return text ? `SMSTO:${normalized}:${encodeURIComponent(text)}` : `SMSTO:${normalized}:`;
}

export function geoPayload({ lat, lon }) {
  const latitude = Number(String(lat).replace(",", "."));
  const longitude = Number(String(lon).replace(",", "."));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Широта должна быть числом от -90 до 90.");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Долгота должна быть числом от -180 до 180.");
  return `geo:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export function vcardPayload({ name, phone, email, org, title, url }) {
  const fullName = String(name || "").trim();
  const cleanPhone = String(phone || "").trim();
  const cleanEmail = String(email || "").trim();
  const cleanOrg = String(org || "").trim();
  const cleanTitle = String(title || "").trim();
  const cleanUrl = String(url || "").trim();
  if (!fullName && !cleanPhone && !cleanEmail && !cleanOrg) {
    throw new Error("Заполните хотя бы имя, телефон, почту или организацию.");
  }
  if (cleanEmail && !isValidEmail(cleanEmail)) throw new Error("В контакте указан некорректный адрес электронной почты.");
  const parts = fullName.split(/\s+/).filter(Boolean);
  const first = parts.length > 1 ? parts.shift() : "";
  const last = parts.join(" ");
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`N:${vcardEscape(last)};${vcardEscape(first)};;;`);
  lines.push(`FN:${vcardEscape(fullName || first || last)}`);
  if (cleanOrg) lines.push(`ORG:${vcardEscape(cleanOrg)}`);
  if (cleanTitle) lines.push(`TITLE:${vcardEscape(cleanTitle)}`);
  if (cleanPhone) {
    const normalized = normalizePhone(cleanPhone);
    if (!normalized) throw new Error("В контакте указан некорректный номер телефона.");
    lines.push(`TEL;TYPE=CELL:${normalized}`);
  }
  if (cleanEmail) lines.push(`EMAIL:${cleanEmail}`);
  if (cleanUrl) lines.push(`URL:${cleanUrl}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export function hexToHSV(hex) {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}

export function hsvToHex({ h, s, v }) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${parts.map((part) => Math.round((part + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

// Relative luminance per WCAG; used to warn about low-contrast code/background pairs.
export function relativeLuminance(hex) {
  const channel = (start) => {
    const raw = parseInt(hex.slice(start, start + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrastRatio(foreground, background) {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

const CHECKDigit_WEIGHTS_13 = [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3];

export function ean13CheckDigit(twelveDigits) {
  if (!/^\d{12}$/.test(twelveDigits)) throw new Error("EAN-13 требует 12 цифр.");
  const sum = twelveDigits.split("").reduce((acc, digit, index) => acc + Number(digit) * CHECKDigit_WEIGHTS_13[index], 0);
  return (10 - (sum % 10)) % 10;
}

export { CHECKDigit_WEIGHTS_13 as EAN13_WEIGHTS };
