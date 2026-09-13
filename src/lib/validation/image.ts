/**
 * Server-side image validation
 * Must be called in server actions BEFORE sending data to Roboflow.
 * Client-side checks (file.type) can be spoofed -- this cannot.
 */

// Max allowed image size: 10MB (base64 is ~33% larger than binary)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3);

/**
 * Check if header bytes match a known image format.
 * WebP requires special handling: bytes 0-3 must be RIFF and bytes 8-11 must be WEBP.
 */
function isKnownImageFormat(headerBytes: number[]): boolean {
  // JPEG: FF D8 FF
  if (
    headerBytes[0] === 0xff &&
    headerBytes[1] === 0xd8 &&
    headerBytes[2] === 0xff
  )
    return true;
  // PNG: 89 50 4E 47
  if (
    headerBytes[0] === 0x89 &&
    headerBytes[1] === 0x50 &&
    headerBytes[2] === 0x4e &&
    headerBytes[3] === 0x47
  )
    return true;
  // GIF: 47 49 46 38
  if (
    headerBytes[0] === 0x47 &&
    headerBytes[1] === 0x49 &&
    headerBytes[2] === 0x46 &&
    headerBytes[3] === 0x38
  )
    return true;
  // WebP: RIFF at 0-3 AND 'W','E','B','P' at bytes 8-11
  if (
    headerBytes[0] === 0x52 &&
    headerBytes[1] === 0x49 &&
    headerBytes[2] === 0x46 &&
    headerBytes[3] === 0x46 &&
    headerBytes[8] === 0x57 &&
    headerBytes[9] === 0x45 &&
    headerBytes[10] === 0x42 &&
    headerBytes[11] === 0x50
  )
    return true;
  return false;
}

/**
 * Validate a base64 image data URI on the server side.
 * Returns an error message string if invalid, or null if valid.
 *
 * @param dataUri - The full data URI string (e.g. "data:image/jpeg;base64,/9j/...")
 */
export function validateImageDataUri(dataUri: string): string | null {
  if (typeof dataUri !== "string" || dataUri.trim() === "") {
    return "Image data is empty or invalid.";
  }

  // Must be a data URI
  if (!dataUri.startsWith("data:")) {
    return "Invalid image format: not a data URI.";
  }

  // Extract base64 payload
  const commaIdx = dataUri.indexOf(",");
  if (commaIdx === -1) {
    return "Invalid image format: malformed data URI.";
  }

  const base64Data = dataUri.slice(commaIdx + 1);

  // Check size before decoding to avoid excessive memory use
  if (base64Data.length > MAX_BASE64_LENGTH) {
    const approxMB = Math.round((base64Data.length * 3) / (4 * 1024 * 1024));
    return `Image too large (approx. ${approxMB}MB). Maximum allowed size is 10MB.`;
  }

  // Validate base64 characters
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
    return "Invalid image format: base64 data contains invalid characters.";
  }

  // Decode first 12 bytes to check magic bytes (WebP needs bytes 8-11)
  let headerBytes: number[];
  try {
    const binaryStr = Buffer.from(base64Data.slice(0, 16), "base64");
    headerBytes = Array.from(binaryStr);
  } catch {
    return "Invalid image format: could not decode image data.";
  }

  if (!isKnownImageFormat(headerBytes)) {
    return "Invalid image format: only JPEG, PNG, GIF, and WebP are supported.";
  }

  return null; // valid
}
