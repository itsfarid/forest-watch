/**
 * Custom error classes for API interactions
 * Each error carries both a user-friendly message and technical details for logging
 */

export type ErrorCode =
  | 'INVALID_API_KEY'
  | 'ACCESS_DENIED'
  | 'MODEL_NOT_FOUND'
  | 'INVALID_IMAGE_FORMAT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN_ERROR';

export class AppError extends Error {
  readonly code: ErrorCode;
  /** Safe message to display to end users */
  readonly userMessage: string;
  /** Full technical detail for server logs */
  readonly technicalMessage: string;
  /** Whether retrying this request makes sense */
  readonly retryable: boolean;
  /** Original error that caused this, if any */
  readonly cause?: unknown;

  constructor(params: {
    code: ErrorCode;
    userMessage: string;
    technicalMessage: string;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(params.technicalMessage);
    this.name = 'AppError';
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.technicalMessage = params.technicalMessage;
    this.retryable = params.retryable;
    this.cause = params.cause;
  }
}

export class RoboflowError extends AppError {
  constructor(params: {
    code: ErrorCode;
    userMessage: string;
    technicalMessage: string;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(params);
    this.name = 'RoboflowError';
  }
}

export class OpenAIError extends AppError {
  constructor(params: {
    code: ErrorCode;
    userMessage: string;
    technicalMessage: string;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(params);
    this.name = 'OpenAIError';
  }
}

/**
 * Map an HTTP status code + optional raw message to a RoboflowError
 */
export function roboflowErrorFromStatus(
  status: number,
  statusText: string,
  cause?: unknown
): RoboflowError {
  switch (true) {
    case status === 400:
      return new RoboflowError({
        code: 'INVALID_IMAGE_FORMAT',
        userMessage: 'Format gambar tidak didukung atau permintaan tidak valid. Coba gunakan JPG atau PNG.',
        technicalMessage: `Roboflow HTTP ${status} ${statusText}`,
        retryable: false,
        cause,
      });
    case status === 401:
    case status === 403:
      return new RoboflowError({
        code: 'INVALID_API_KEY',
        userMessage: 'Layanan analisis sedang bermasalah. Silakan coba lagi nanti.',
        technicalMessage: `Roboflow HTTP ${status} ${statusText} — API key invalid atau tidak punya akses`,
        retryable: false,
        cause,
      });
    case status === 404:
      return new RoboflowError({
        code: 'MODEL_NOT_FOUND',
        userMessage: 'Model deteksi tidak ditemukan. Periksa konfigurasi ROBOFLOW_MODEL_ID.',
        technicalMessage: `Roboflow HTTP ${status} ${statusText} — model tidak ditemukan`,
        retryable: false,
        cause,
      });
    case status === 429:
      return new RoboflowError({
        code: 'RATE_LIMITED',
        userMessage: 'Terlalu banyak permintaan. Tunggu beberapa saat lalu coba lagi.',
        technicalMessage: `Roboflow HTTP ${status} ${statusText} — rate limit tercapai`,
        retryable: true,
        cause,
      });
    case status >= 500:
      return new RoboflowError({
        code: 'SERVER_ERROR',
        userMessage: 'Layanan Roboflow sedang mengalami gangguan. Coba lagi nanti.',
        technicalMessage: `Roboflow HTTP ${status} ${statusText} — server error`,
        retryable: true,
        cause,
      });
    default:
      return new RoboflowError({
        code: 'UNKNOWN_ERROR',
        userMessage: 'Terjadi kesalahan saat menganalisis gambar. Coba lagi.',
        technicalMessage: `Roboflow HTTP ${status} ${statusText}`,
        retryable: false,
        cause,
      });
  }
}

/**
 * Map a caught error (network/timeout/unknown) to a RoboflowError
 */
export function roboflowErrorFromException(error: unknown): RoboflowError {
  if (error instanceof RoboflowError) return error;

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (error instanceof Error && error.name === 'AbortError') {
    return new RoboflowError({
      code: 'TIMEOUT',
      userMessage: 'Permintaan memakan waktu terlalu lama. Coba lagi.',
      technicalMessage: `Roboflow request timeout: ${error.message}`,
      retryable: true,
      cause: error,
    });
  }

  if (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout')
  ) {
    return new RoboflowError({
      code: 'NETWORK_ERROR',
      userMessage: 'Tidak dapat terhubung ke layanan. Periksa koneksi internet Anda.',
      technicalMessage: `Roboflow network error: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      cause: error,
    });
  }

  return new RoboflowError({
    code: 'UNKNOWN_ERROR',
    userMessage: 'Terjadi kesalahan tak terduga. Coba lagi.',
    technicalMessage: `Roboflow unknown error: ${error instanceof Error ? error.message : String(error)}`,
    retryable: false,
    cause: error,
  });
}

/**
 * Map a caught error from OpenAI to an OpenAIError
 */
export function openaiErrorFromException(error: unknown): OpenAIError {
  if (error instanceof OpenAIError) return error;

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('401') || message.includes('invalid api key') || message.includes('incorrect api key')) {
    return new OpenAIError({
      code: 'INVALID_API_KEY',
      userMessage: 'Layanan AI sedang bermasalah. Silakan coba lagi nanti.',
      technicalMessage: `OpenAI auth error: ${error instanceof Error ? error.message : String(error)}`,
      retryable: false,
      cause: error,
    });
  }

  if (message.includes('429') || message.includes('rate limit')) {
    return new OpenAIError({
      code: 'RATE_LIMITED',
      userMessage: 'Terlalu banyak permintaan ke AI. Tunggu beberapa saat lalu coba lagi.',
      technicalMessage: `OpenAI rate limit: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      cause: error,
    });
  }

  if (message.includes('timeout') || (error instanceof Error && error.name === 'AbortError')) {
    return new OpenAIError({
      code: 'TIMEOUT',
      userMessage: 'Permintaan ke AI memakan waktu terlalu lama. Coba lagi.',
      technicalMessage: `OpenAI timeout: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      cause: error,
    });
  }

  if (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset')
  ) {
    return new OpenAIError({
      code: 'NETWORK_ERROR',
      userMessage: 'Tidak dapat terhubung ke layanan AI. Periksa koneksi internet Anda.',
      technicalMessage: `OpenAI network error: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      cause: error,
    });
  }

  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return new OpenAIError({
      code: 'SERVER_ERROR',
      userMessage: 'Layanan AI sedang mengalami gangguan. Coba lagi nanti.',
      technicalMessage: `OpenAI server error: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      cause: error,
    });
  }

  return new OpenAIError({
    code: 'UNKNOWN_ERROR',
    userMessage: 'Terjadi kesalahan saat memproses permintaan. Coba lagi.',
    technicalMessage: `OpenAI unknown error: ${error instanceof Error ? error.message : String(error)}`,
    retryable: false,
    cause: error,
  });
}
