import type { AuditLog, SessionUser } from "@/lib/types";

const promptInjectionPatterns = [
  /ignore (all )?(previous|above) instructions/i,
  /reveal (the )?(system|developer) prompt/i,
  /exfiltrate|bypass|jailbreak|disable safety/i,
  /api[_ -]?key|secret token|private key/i,
];

const sensitivePatterns = [
  { label: "email", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { label: "api_key", pattern: /\b(sk|pk|ghp|hf)_[A-Za-z0-9_]{12,}\b/g },
  { label: "credit_card", pattern: /\b(?:\d[ -]*?){13,16}\b/g },
];

export type SecurityAssessment = {
  riskLevel: "low" | "medium" | "high";
  blocked: boolean;
  findings: string[];
  sanitizedInput: string;
};

export function maskSensitiveData(input: string) {
  let output = input;
  for (const item of sensitivePatterns) {
    output = output.replace(item.pattern, `[redacted:${item.label}]`);
  }
  return output;
}

export function assessInput(input: string): SecurityAssessment {
  const findings: string[] = [];
  const sanitizedInput = maskSensitiveData(input).trim().slice(0, 12_000);

  for (const pattern of promptInjectionPatterns) {
    if (pattern.test(input)) {
      findings.push("prompt_injection_signal");
      break;
    }
  }

  if (sanitizedInput !== input.trim().slice(0, 12_000)) {
    findings.push("sensitive_data_masked");
  }

  if (input.length > 12_000) {
    findings.push("input_truncated");
  }

  const riskLevel = findings.includes("prompt_injection_signal")
    ? "high"
    : findings.length
      ? "medium"
      : "low";

  return {
    riskLevel,
    blocked: false,
    findings,
    sanitizedInput,
  };
}

export function securityAuditFromAssessment(
  session: SessionUser,
  assessment: SecurityAssessment,
  targetId: string,
): Omit<AuditLog, "id" | "createdAt"> | null {
  if (!assessment.findings.length) {
    return null;
  }

  return {
    organizationId: session.organizationId,
    actorUserId: session.id,
    action: "security.input_assessed",
    targetType: "chat_prompt",
    targetId,
    metadata: {
      riskLevel: assessment.riskLevel,
      findings: assessment.findings,
    },
  };
}
