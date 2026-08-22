import { isRetryableError } from "../lib/utils";

describe("isRetryableError", () => {
  it("retries on AbortError (timeout)", () => {
    const err = new DOMException("aborted", "AbortError");
    expect(isRetryableError(err)).toBe(true);
  });

  it("retries on network errors", () => {
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableError(new Error("network error"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
  });

  it("retries on HTTP 429", () => {
    expect(isRetryableError(new Error("HTTP 429 Too Many Requests"))).toBe(
      true,
    );
  });

  it("retries on HTTP 5xx", () => {
    expect(
      isRetryableError(new Error("status 500 Internal Server Error")),
    ).toBe(true);
    expect(isRetryableError(new Error("status 503 Service Unavailable"))).toBe(
      true,
    );
  });

  it("does not retry on HTTP 400", () => {
    expect(isRetryableError(new Error("HTTP 400 Bad Request"))).toBe(false);
  });

  it("does not retry on HTTP 401", () => {
    expect(isRetryableError(new Error("HTTP 401 Unauthorized"))).toBe(false);
  });

  it("does not retry on HTTP 403", () => {
    expect(isRetryableError(new Error("HTTP 403 Forbidden"))).toBe(false);
  });

  it("does not retry on HTTP 404", () => {
    expect(isRetryableError(new Error("HTTP 404 Not Found"))).toBe(false);
  });

  it("retries on unknown errors by default", () => {
    expect(isRetryableError(new Error("some unknown error"))).toBe(true);
    expect(isRetryableError("string error")).toBe(true);
  });
});
