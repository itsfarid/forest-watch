import {
  roboflowErrorFromStatus,
  openaiErrorFromException,
  RoboflowError,
  OpenAIError,
} from "../lib/errors/api-errors";

describe("roboflowErrorFromStatus", () => {
  it("maps 400 to INVALID_IMAGE_FORMAT, not retryable", () => {
    const err = roboflowErrorFromStatus(400, "Bad Request");
    expect(err).toBeInstanceOf(RoboflowError);
    expect(err.code).toBe("INVALID_IMAGE_FORMAT");
    expect(err.retryable).toBe(false);
    expect(err.userMessage).toBeTruthy();
  });

  it("maps 401 to INVALID_API_KEY, not retryable", () => {
    const err = roboflowErrorFromStatus(401, "Unauthorized");
    expect(err.code).toBe("INVALID_API_KEY");
    expect(err.retryable).toBe(false);
  });

  it("maps 403 to INVALID_API_KEY, not retryable", () => {
    const err = roboflowErrorFromStatus(403, "Forbidden");
    expect(err.code).toBe("INVALID_API_KEY");
    expect(err.retryable).toBe(false);
  });

  it("maps 404 to MODEL_NOT_FOUND, not retryable", () => {
    const err = roboflowErrorFromStatus(404, "Not Found");
    expect(err.code).toBe("MODEL_NOT_FOUND");
    expect(err.retryable).toBe(false);
  });

  it("maps 429 to RATE_LIMITED, retryable", () => {
    const err = roboflowErrorFromStatus(429, "Too Many Requests");
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("maps 500 to SERVER_ERROR, retryable", () => {
    const err = roboflowErrorFromStatus(500, "Internal Server Error");
    expect(err.code).toBe("SERVER_ERROR");
    expect(err.retryable).toBe(true);
  });

  it("maps 503 to SERVER_ERROR, retryable", () => {
    const err = roboflowErrorFromStatus(503, "Service Unavailable");
    expect(err.code).toBe("SERVER_ERROR");
    expect(err.retryable).toBe(true);
  });

  it("userMessage does not expose API key details for 401", () => {
    const err = roboflowErrorFromStatus(401, "Unauthorized");
    expect(err.userMessage.toLowerCase()).not.toContain("api key");
    expect(err.userMessage.toLowerCase()).not.toContain("unauthorized");
  });
});

describe("openaiErrorFromException", () => {
  it("detects rate limit errors", () => {
    const err = openaiErrorFromException(new Error("429 rate limit exceeded"));
    expect(err).toBeInstanceOf(OpenAIError);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("detects auth errors", () => {
    const err = openaiErrorFromException(new Error("401 invalid api key"));
    expect(err.code).toBe("INVALID_API_KEY");
    expect(err.retryable).toBe(false);
  });

  it("detects network errors", () => {
    const err = openaiErrorFromException(new Error("fetch failed"));
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.retryable).toBe(true);
  });

  it("wraps unknown errors as UNKNOWN_ERROR", () => {
    const err = openaiErrorFromException(new Error("something weird"));
    expect(err.code).toBe("UNKNOWN_ERROR");
  });

  it("passes through existing OpenAIError unchanged", () => {
    const original = new OpenAIError({
      code: "TIMEOUT",
      userMessage: "too slow",
      technicalMessage: "timeout",
      retryable: true,
    });
    expect(openaiErrorFromException(original)).toBe(original);
  });
});
