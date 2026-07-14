import { assessInput } from "@/lib/security/controls";
import { recordSecurityEvent } from "@/lib/data/store";
import type { SessionUser } from "@/lib/types";
import { logEvent } from "@/modules/shared/logger";

export function assessAndRecordPrompt(input: {
  session: SessionUser;
  text: string;
  targetId: string;
  targetType: string;
  requestId?: string;
}) {
  const assessment = assessInput(input.text);
  if (assessment.findings.length) {
    recordSecurityEvent({
      organizationId: input.session.organizationId,
      actorUserId: input.session.id,
      riskLevel: assessment.riskLevel,
      findings: assessment.findings,
      action: "security.input_assessed",
      targetType: input.targetType,
      targetId: input.targetId,
    });
    logEvent(
      assessment.riskLevel === "high" ? "warn" : "info",
      {
        component: "security",
        action: "security.input_assessed",
        organizationId: input.session.organizationId,
        userId: input.session.id,
        requestId: input.requestId,
      },
      "Input security assessment recorded",
      { findings: assessment.findings, riskLevel: assessment.riskLevel },
    );
  }
  return assessment;
}
