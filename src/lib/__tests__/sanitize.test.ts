import { sanitizeString, sanitizeBody } from "../sanitize";

describe("sanitizeString", () => {
  it("strips HTML tags", () => {
    expect(sanitizeString('<script>alert("xss")</script>hello')).toBe("hello");
  });

  it("strips inline HTML", () => {
    expect(sanitizeString("<b>bold</b> text")).toBe("bold text");
  });

  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("enforces max length", () => {
    expect(sanitizeString("abcdef", 3)).toBe("abc");
  });

  it("passes clean strings through unchanged", () => {
    expect(sanitizeString("Hello World")).toBe("Hello World");
  });
});

describe("sanitizeBody", () => {
  it("sanitizes nested string fields", () => {
    const result = sanitizeBody({ name: "<b>Circle</b>", nested: { bio: "<em>hi</em>" } });
    expect(result).toEqual({ name: "Circle", nested: { bio: "hi" } });
  });

  it("passes valid numbers through", () => {
    expect(sanitizeBody({ amount: 1000 })).toEqual({ amount: 1000 });
  });

  it("nullifies non-finite numbers", () => {
    expect(sanitizeBody({ amount: NaN })).toEqual({ amount: null });
    expect(sanitizeBody({ amount: Infinity })).toEqual({ amount: null });
  });

  it("passes booleans through", () => {
    expect(sanitizeBody({ enabled: true })).toEqual({ enabled: true });
  });

  it("sanitizes strings inside arrays", () => {
    expect(sanitizeBody({ tags: ["<b>a</b>", "b"] })).toEqual({ tags: ["a", "b"] });
  });

  it("handles null values", () => {
    expect(sanitizeBody({ field: null })).toEqual({ field: null });
  });
});
