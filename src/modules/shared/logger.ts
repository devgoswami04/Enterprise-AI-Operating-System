export type LogSeverity = "debug" | "info" | "warn" | "error";

export type LogContext = {
  organizationId?: string;
  requestId?: string;
  userId?: string;
  component: string;
  action?: string;
};

export type StructuredLog = LogContext & {
  timestamp: string;
  severity: LogSeverity;
  message: string;
  metadata: Record<string, unknown>;
};

const logs: StructuredLog[] = [];

export function createRequestId(prefix = "req") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function logEvent(
  severity: LogSeverity,
  context: LogContext,
  message: string,
  metadata: Record<string, unknown> = {},
) {
  const entry: StructuredLog = {
    timestamp: new Date().toISOString(),
    severity,
    message,
    metadata,
    ...context,
  };

  logs.unshift(entry);
  logs.splice(250);

  const line = JSON.stringify(entry);
  if (severity === "error") {
    console.error(line);
  } else if (severity === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }

  return entry;
}

export function listStructuredLogs(organizationId?: string) {
  return logs.filter((entry) => !organizationId || entry.organizationId === organizationId);
}
