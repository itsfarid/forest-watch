import { sanitizeTextInput, isValidTextInput } from "../lib/validation/text";

describe("sanitizeTextInput", () => {
  it("trims whitespace", () => {
    expect(sanitizeTextInput("  hello  ")).toBe("hello");
  });

  it("strips HTML tags", () => {
    expect(sanitizeTextInput("<script>alert(1)</script>hello")).toBe("hello");
  });

  it("strips nested HTML tags", () => {
    expect(sanitizeTextInput("<b>bold</b> text")).toBe("bold text");
  });

  it("does not modify normal text", () => {
    expect(sanitizeTextInput("hello world")).toBe("hello world");
  });

  it("truncates text exceeding max length", () => {
    const long = "a".repeat(1100);
    expect(sanitizeTextInput(long).length).toBe(1000);
  });

  it("handles empty string", () => {
    expect(sanitizeTextInput("")).toBe("");
  });

  it("collapses multiple spaces after stripping tags", () => {
    expect(sanitizeTextInput("hello   world")).toBe("hello world");
  });

  it("throws for non-string input", () => {
    expect(() => sanitizeTextInput(123 as unknown as string)).toThrow();
  });
});

describe("isValidTextInput", () => {
  it("returns true for non-empty text", () => {
    expect(isValidTextInput("hello")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidTextInput("")).toBe(false);
  });

  it("returns false for whitespace-only input", () => {
    expect(isValidTextInput("   ")).toBe(false);
  });

  it("returns false for HTML-only input", () => {
    expect(isValidTextInput("<b></b>")).toBe(false);
  });
});
