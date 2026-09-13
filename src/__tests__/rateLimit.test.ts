process.env.OPENAI_API_KEY = "mock-openai-key";
process.env.ROBOFLOW_API_KEY = "mock-roboflow-key";
process.env.ROBOFLOW_MODEL_ID = "mock-model";

import { continueConversation, Message } from "../../app/actions";
import {
  defaultRateLimiter,
  MemoryRateLimiter,
} from "@/lib/security/rate-limiter";
import * as openaiService from "@/lib/services/openai.service";
import * as roboflowService from "@/lib/services/roboflow.service";

// Mock external services to prevent real network calls
jest.mock("@/lib/services/openai.service");
jest.mock("@/lib/services/roboflow.service");

// Mock next/headers getClientIp fallback
jest.mock("next/headers", () => ({
  headers: () => new Map(),
}));

describe("MemoryRateLimiter Unit Tests", () => {
  let rateLimiter: MemoryRateLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
    rateLimiter = new MemoryRateLimiter(5, 60000); // 5 req per 60s
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("allows the first request", () => {
    const result = rateLimiter.checkRateLimit("192.168.1.1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows requests below the max limit", () => {
    for (let i = 0; i < 5; i++) {
      const res = rateLimiter.checkRateLimit("192.168.1.1");
      expect(res.allowed).toBe(true);
    }
  });

  it("rejects requests exceeding the max limit", () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.checkRateLimit("192.168.1.1");
    }
    const rejected = rateLimiter.checkRateLimit("192.168.1.1");
    expect(rejected.allowed).toBe(false);
    expect(rejected.remaining).toBe(0);
  });

  it("isolates different IP addresses", () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.checkRateLimit("192.168.1.1");
    }
    expect(rateLimiter.checkRateLimit("192.168.1.1").allowed).toBe(false);
    // Different IP should still be allowed
    expect(rateLimiter.checkRateLimit("192.168.1.2").allowed).toBe(true);
  });

  it("resets limit after the sliding window expires", () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.checkRateLimit("192.168.1.1");
    }
    expect(rateLimiter.checkRateLimit("192.168.1.1").allowed).toBe(false);

    // Fast-forward past window duration (60 seconds)
    jest.advanceTimersByTime(60001);

    expect(rateLimiter.checkRateLimit("192.168.1.1").allowed).toBe(true);
  });
});

describe("Server Action Rate Limiting & Provider Isolation", () => {
  const mockGenerateChat = openaiService.generateChatCompletion as jest.Mock;
  const mockRoboflowAPI = roboflowService.callRoboflowInferenceAPI as jest.Mock;
  const mockIsRoboflowConfigured =
    roboflowService.isRoboflowConfigured as jest.Mock;

  beforeEach(() => {
    defaultRateLimiter.reset();
    jest.clearAllMocks();
    mockGenerateChat.mockResolvedValue("AI response");
    mockIsRoboflowConfigured.mockReturnValue(true);
    mockRoboflowAPI.mockResolvedValue({
      success: true,
      predictions: [],
    });
  });

  it("does NOT call OpenAI or Roboflow when rate limit is exceeded", async () => {
    const userMessage: Message[] = [
      { role: "user", content: "Hello deforestation AI" },
    ];

    // Make 5 successful calls (reaching limit)
    for (let i = 0; i < 5; i++) {
      const res = await continueConversation(userMessage);
      expect(res.messages[res.messages.length - 1].content).not.toContain(
        "Too many requests",
      );
    }

    expect(mockGenerateChat).toHaveBeenCalledTimes(5);

    // 6th call should be blocked by rate limiter
    const blockedRes = await continueConversation(userMessage);
    const lastMsgContent =
      blockedRes.messages[blockedRes.messages.length - 1].content;

    expect(lastMsgContent).toContain("Too many requests");
    // Ensure mockGenerateChat was NOT called on the 6th attempt
    expect(mockGenerateChat).toHaveBeenCalledTimes(5);
    expect(mockRoboflowAPI).not.toHaveBeenCalled();
  });
});
