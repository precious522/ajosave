import { encrypt, decrypt, hmacIndex, hmacIndexEquals } from "@/lib/encryption";

// Provide well-formed 32-byte hex keys for the duration of the tests
const TEST_ENC_KEY = "a".repeat(64); // 32 bytes, all 0xaa
const TEST_HMAC_KEY = "b".repeat(64); // 32 bytes, all 0xbb

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY = TEST_ENC_KEY;
  process.env.PII_HMAC_KEY = TEST_HMAC_KEY;
});

afterAll(() => {
  delete process.env.PII_ENCRYPTION_KEY;
  delete process.env.PII_HMAC_KEY;
});

describe("encrypt / decrypt", () => {
  it("returns a string with three base64url segments", () => {
    const token = encrypt("+2348012345678");
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
  });

  it("round-trips plaintext correctly", () => {
    const plaintext = "+2348012345678";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("round-trips email correctly", () => {
    const email = "user@example.com";
    expect(decrypt(encrypt(email))).toBe(email);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const plaintext = "+2348012345678";
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it("throws on tampered ciphertext", () => {
    const token = encrypt("secret");
    const parts = token.split(".");
    // Corrupt the ciphertext segment
    parts[1] = Buffer.from("corrupt").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("throws on invalid payload format", () => {
    expect(() => decrypt("not.a.valid.four.segment")).toThrow("Invalid encrypted payload format");
  });

  it("throws when PII_ENCRYPTION_KEY is missing", () => {
    const original = process.env.PII_ENCRYPTION_KEY;
    delete process.env.PII_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow("PII_ENCRYPTION_KEY");
    process.env.PII_ENCRYPTION_KEY = original!;
  });
});

describe("hmacIndex", () => {
  it("returns a non-empty string", () => {
    expect(hmacIndex("+2348012345678").length).toBeGreaterThan(0);
  });

  it("is deterministic — same input yields same hash", () => {
    const phone = "+2348012345678";
    expect(hmacIndex(phone)).toBe(hmacIndex(phone));
  });

  it("produces different hashes for different inputs", () => {
    expect(hmacIndex("+2348012345678")).not.toBe(hmacIndex("+2347099887766"));
  });

  it("throws when PII_HMAC_KEY is missing", () => {
    const original = process.env.PII_HMAC_KEY;
    delete process.env.PII_HMAC_KEY;
    expect(() => hmacIndex("x")).toThrow("PII_HMAC_KEY");
    process.env.PII_HMAC_KEY = original!;
  });
});

describe("hmacIndexEquals", () => {
  it("returns true for identical hashes", () => {
    const h = hmacIndex("+2348012345678");
    expect(hmacIndexEquals(h, h)).toBe(true);
  });

  it("returns false for different hashes", () => {
    expect(hmacIndexEquals(hmacIndex("a"), hmacIndex("b"))).toBe(false);
  });

  it("returns false for hashes of different lengths", () => {
    expect(hmacIndexEquals("short", "a".repeat(50))).toBe(false);
  });
});
