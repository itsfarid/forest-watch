/**
 * Server-side image validation
 * Must be called in server actions BEFORE sending data to Roboflow.
 * Client-side checks (file.type) can be spoofed -- this cannot.
 */

// Max allowed image size: 10MB (base64 is ~33% larger than binary)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3);

/**
 * Magic bytes (file signatures) for supported image formats.
 * These are checked against the actual binary content, not the MIME type string.
 */
const IMAGE_SIGNATURES: { format: string; bytes: number[] }[] = [
  { format: 'JPEG', bytes: [0xff, 0xd8, 0xff] },
  { format: 'PNG',  bytes: [0x89, 0x50, 0x4e, 0x47] },
  { format: 'GIF',  bytes: [0x47, 0x49, 0x46, 0x38] },
  { format: 'WEBP', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header (WEBP)
];

/**
 * Validate a base64 image data URI on the server side.
 * Returns an error message string if invalid, or null if valid.
 *
 * @param dataUri - The full data URI string (e.g. "data:image/jpeg;base64,/9j/...")
 */
export function validateImageDataUri(dataUri: string): string | null {
  if (typeof dataUri !== 'string' || dataUri.trim() === '') {
    return 'Image data is empty or invalid.';
  }

  // Must be a data URI
  if (!dataUri.startsWith('data:')) {
    return 'Invalid image format: not a data URI.';
  }

  // Extract base64 payload
  const commaIdx = dataUri.indexOf(',');
  if (commaIdx === -1) {
    return 'Invalid image format: malformed data URI.';
  }

  const base64Data = dataUri.slice(commaIdx + 1);

  // Check size before decoding to avoid excessive memory use
  if (base64Data.length > MAX_BASE64_LENGTH) {
    const approxMB = Math.round((base64Data.length * 3) / (4 * 1024 * 1024));
    return `Image too large (approx. ${approxMB}MB). Maximum allowed size is 10MB.`;
  }

  // Validate base64 characters
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
    return 'Invalid image format: base64 data contains invalid characters.';
  }

  // Decode just the first few bytes to check magic bytes
  let headerBytes: number[];
  try {
    const binaryStr = Buffer.from(base64Data.slice(0, 16), 'base64');
    headerBytes = Array.from(binaryStr);
  } catch {
    return 'Invalid image format: could not decode image data.';
  }

  // Check magic bytes against known image signatures
  const isKnownFormat = IMAGE_SIGNATURES.some(({ bytes }) =>
    bytes.every((b, i) => headerBytes[i] === b)
  );

  if (!isKnownFormat) {
    return 'Invalid image format: only JPEG, PNG, GIF, and WebP are supported.';
  }

  return null; // valid
}
