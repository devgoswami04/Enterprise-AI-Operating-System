import { WorkflowLauncher } from "@/components/workflows/workflow-launcher";
import { requireSession } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data/store";

export default async function WorkflowsPage() {
  const session = await requireSession();
  const snapshot = await getDashboardSnapshot(session.organizationId);

  return (
    <div className="grid gap-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-normal text-white">Workflow Automation</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Convert AI into execution: run repeatable workflows, stream status, stop on high-impact tool actions, and preserve approvals.
        </p>
      </section>
      <WorkflowLauncher
        workflows={snapshot.workflows}
        initialRuns={snapshot.workflowRuns}
        initialToolCalls={snapshot.toolCalls}
      />
    </div>
  );
}
