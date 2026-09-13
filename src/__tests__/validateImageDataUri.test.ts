import { validateImageDataUri } from "../lib/validation/image";

// Minimal valid JPEG base64 (starts with FF D8 FF)
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString(
  "base64",
);
// Minimal valid PNG base64 (starts with 89 50 4E 47)
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]).toString("base64");
// Valid WebP: RIFF (0-3) + size (4-7) + WEBP (8-11)
const WEBP_HEADER = Buffer.from([
  0x52,
  0x49,
  0x46,
  0x46, // RIFF
  0x00,
  0x00,
  0x00,
  0x00, // file size
  0x57,
  0x45,
  0x42,
  0x50, // WEBP
  0x56,
  0x50,
  0x38,
  0x20, // VP8 chunk
]).toString("base64");
// Non-image bytes (PDF header: %PDF)
const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]).toString(
  "base64",
);
// RIFF but NOT WebP (e.g. WAV file)
const WAV_HEADER = Buffer.from([
  0x52,
  0x49,
  0x46,
  0x46, // RIFF
  0x00,
  0x00,
  0x00,
  0x00, // file size
  0x57,
  0x41,
  0x56,
  0x45, // WAVE (not WEBP)
  0x00,
  0x00,
  0x00,
  0x00,
]).toString("base64");

describe("validateImageDataUri", () => {
  it("accepts valid JPEG data URI", () => {
    expect(
      validateImageDataUri(`data:image/jpeg;base64,${JPEG_HEADER}`),
    ).toBeNull();
  });

  it("accepts valid PNG data URI", () => {
    expect(
      validateImageDataUri(`data:image/png;base64,${PNG_HEADER}`),
    ).toBeNull();
  });

  it("accepts valid WebP data URI", () => {
    expect(
      validateImageDataUri(`data:image/webp;base64,${WEBP_HEADER}`),
    ).toBeNull();
  });

  it("rejects RIFF file that is not WebP (e.g. WAV)", () => {
    const result = validateImageDataUri(`data:image/webp;base64,${WAV_HEADER}`);
    expect(result).not.toBeNull();
    expect(result).toMatch(/format/i);
  });

  it("rejects non-image file disguised as JPEG (PDF bytes)", () => {
    const result = validateImageDataUri(`data:image/jpeg;base64,${PDF_HEADER}`);
    expect(result).not.toBeNull();
    expect(result).toMatch(/format/i);
  });

  it("rejects empty string", () => {
    expect(validateImageDataUri("")).not.toBeNull();
  });

  it("rejects non-data URI string", () => {
    expect(
      validateImageDataUri("https://example.com/image.jpg"),
    ).not.toBeNull();
  });

  it("rejects malformed data URI (no comma)", () => {
    expect(validateImageDataUri("data:image/jpeg;base64")).not.toBeNull();
  });

  it("rejects base64 with invalid characters", () => {
    expect(
      validateImageDataUri("data:image/jpeg;base64,!!!invalid!!!"),
    ).not.toBeNull();
  });

  it("rejects oversized image", () => {
    // Create a base64 string longer than the max allowed
    const oversized = "A".repeat(14_000_000); // ~10MB+ base64
    const result = validateImageDataUri(`data:image/jpeg;base64,${oversized}`);
    expect(result).not.toBeNull();
    expect(result).toMatch(/too large/i);
  });
});
