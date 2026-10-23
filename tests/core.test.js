import { describe, it, expect } from "vitest";
import {
  wifiEscape,
  vcardEscape,
  normalizePhone,
  isValidEmail,
  wifiPayload,
  smsPayload,
  geoPayload,
  vcardPayload,
  hexToHSV,
  hsvToHex,
  contrastRatio,
  ean13CheckDigit,
} from "../core.js";

describe("wifiEscape / vcardEscape", () => {
  it("escapes backslash, semicolon, colon and quotes in Wi-Fi fields", () => {
    expect(wifiEscape('my;net:"x"\\y')).toBe('my\\;net\\:\\"x\\"\\\\y');
  });

  it("escapes commas, semicolons and dots in vCard values", () => {
    expect(vcardEscape("Doe, John")).toBe("Doe\\, John");
    expect(vcardEscape("line1\nline2")).toBe("line1\\nline2");
  });
});

describe("normalizePhone", () => {
  it("strips spaces, parentheses and dashes", () => {
    expect(normalizePhone("+7 (999) 123-45-67")).toBe("+79991234567");
  });

  it("rejects too short or non-numeric input", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("isValidEmail", () => {
  it("accepts well-formed addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("no at sign")).toBe(false);
  });
});

describe("payload builders", () => {
  it("builds a WIFI payload", () => {
    const payload = wifiPayload({ ssid: "HomeNet", password: "p@ss;word", security: "WPA" });
    expect(payload).toBe("WIFI:T:WPA;S:HomeNet;P:p@ss\\;word;;");
  });

  it("omits the password for open networks", () => {
    expect(wifiPayload({ ssid: "Cafe", password: "", security: "nopass" })).toBe(
      "WIFI:T:nopass;S:Cafe;P:;;"
    );
  });

  it("throws when SSID is empty", () => {
    expect(() => wifiPayload({ ssid: "  ", password: "x", security: "WPA" })).toThrow();
  });

  it("builds SMSTO payloads with encoded body", () => {
    expect(smsPayload({ phone: "+1 555 000 1111", body: "Hi there" })).toBe(
      "SMSTO:+15550001111:Hi%20there"
    );
    expect(smsPayload({ phone: "+15550001111", body: "" })).toBe("SMSTO:+15550001111:");
  });

  it("rejects invalid SMS phone numbers", () => {
    expect(() => smsPayload({ phone: "not-a-phone", body: "" })).toThrow();
  });

  it("builds geo payloads and accepts comma decimals", () => {
    expect(geoPayload({ lat: "55.7558", lon: "37.6173" })).toBe("geo:55.755800,37.617300");
    expect(geoPayload({ lat: "-33,8688", lon: "151.2093" })).toBe("geo:-33.868800,151.209300");
  });

  it("validates geo ranges", () => {
    expect(() => geoPayload({ lat: "91", lon: "0" })).toThrow();
    expect(() => geoPayload({ lat: "0", lon: "181" })).toThrow();
  });

  it("builds a full vCard 3.0", () => {
    const payload = vcardPayload({
      name: "John Doe",
      phone: "+1 (555) 000-11-11",
      email: "john@example.com",
      org: "Acme, Inc.",
      title: "CTO",
      url: "https://example.com",
    });
    expect(payload).toContain("BEGIN:VCARD");
    expect(payload).toContain("VERSION:3.0");
    expect(payload).toContain("N:Doe;John;;;");
    expect(payload).toContain("FN:John Doe");
    expect(payload).toContain("ORG:Acme\\, Inc\\.");
    expect(payload).toContain("TITLE:CTO");
    expect(payload).toContain("TEL;TYPE=CELL:+15550001111");
    expect(payload).toContain("EMAIL:john@example.com");
    expect(payload).toContain("URL:https://example.com");
    expect(payload.trimEnd().endsWith("END:VCARD")).toBe(true);
  });

  it("requires at least one identifying field in vCard", () => {
    expect(() => vcardPayload({ name: "", phone: "", email: "", org: "" })).toThrow();
  });

  it("rejects bad email/phone inside vCard", () => {
    expect(() => vcardPayload({ name: "A B", email: "bad@@mail" })).toThrow();
    expect(() => vcardPayload({ name: "A B", phone: "abcdefgh" })).toThrow();
  });
});

describe("color helpers", () => {
  it("converts known colors to HSV", () => {
    expect(hexToHSV("#ff0000")).toMatchObject({ h: 0, s: 1, v: 1 });
    expect(hexToHSV("#00ff00").h).toBeCloseTo(120);
    expect(hexToHSV("#0000ff").h).toBeCloseTo(240);
    expect(hexToHSV("#ffffff")).toMatchObject({ h: 0, s: 0, v: 1 });
  });

  it("round-trips hex -> HSV -> hex", () => {
    for (const color of ["#101827", "#e63946", "#f1faee", "#a8dadc", "#457b9d"]) {
      expect(hsvToHex(hexToHSV(color))).toBe(color.toUpperCase());
    }
  });

  it("computes WCAG contrast ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // black on white vs white on black must be symmetric
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#000000"),
      10
    );
  });
});

describe("ean13CheckDigit", () => {
  it("computes correct check digits", () => {
    expect(ean13CheckDigit("590123412345")).toBe(7); // classic example
    expect(ean13CheckDigit("400638133393")).toBe(1);
  });

  it("rejects wrong-length input", () => {
    expect(() => ean13CheckDigit("123")).toThrow();
    expect(() => ean13CheckDigit("abcdefghijkl")).toThrow();
  });
});
