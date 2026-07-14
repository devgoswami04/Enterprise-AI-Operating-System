export type ErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHORIZATION_DENIED"
  | "VALIDATION_FAILED"
  | "SECURITY_BLOCKED"
  | "PROVIDER_FAILED"
  | "WORKFLOW_FAILED"
  | "RETRYABLE_FAILURE"
  | "NOT_FOUND"
  | "RATE_LIMITED";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      status?: number;
      retryable?: boolean;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? 500;
    this.retryable = options.retryable ?? false;
    this.details = options.details ?? {};
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("VALIDATION_FAILED", message, { status: 400, details });
  }
}

export class SecurityError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("SECURITY_BLOCKED", message, { status: 403, details });
  }
}

export class RetryableError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("RETRYABLE_FAILURE", message, { status: 503, retryable: true, details });
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: error.message,
        code: error.code,
        retryable: error.retryable,
        details: error.details,
      },
      { status: error.status },
    );
  }

  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return Response.json(
      { error: "Unauthenticated", code: "AUTHENTICATION_REQUIRED" },
      { status: 401 },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected platform error";
  return Response.json({ error: message, code: "PROVIDER_FAILED" }, { status: 500 });
}
