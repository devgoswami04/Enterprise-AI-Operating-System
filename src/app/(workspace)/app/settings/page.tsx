import { CheckCircle2, KeyRound, PlugZap, Shield } from "lucide-react";
import Link from "next/link";
import { SystemStatus } from "@/components/settings/system-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { getDemoUsers } from "@/lib/data/store";
import { getSystemHealth } from "@/lib/system/health";
import { getProviderPosture } from "@/modules/providers/service";

export default async function SettingsPage() {
  const session = await requireSession();
  const users = getDemoUsers();
  const health = getSystemHealth();
  const posture = getProviderPosture();
  const integrations = [
    ["AI Gateway / OpenAI", "AI_PROVIDER", posture.ai.liveReady ? "live-ready" : posture.ai.provider],
    ["Embeddings", "EMBEDDING_PROVIDER", posture.embeddings.liveReady ? posture.embeddings.provider : "not configured"],
    ["Hugging Face", "HUGGINGFACE_API_TOKEN", posture.embeddings.provider === "huggingface" ? "configured" : "optional"],
    ["GitHub", "GITHUB_TOKEN", posture.tools.githubReady ? "configured" : "not configured"],
    ["Slack", "SLACK_BOT_TOKEN", posture.tools.slackReady ? "configured" : "not configured"],
    ["Calendar", "CALENDAR_WEBHOOK_URL", posture.tools.calendarReady ? "configured" : "not configured"],
    ["Queues", "QUEUE_PROVIDER", posture.queues.provider],
    ["Persistence", "DATABASE_URL", posture.persistence.databaseReady ? "postgres-ready" : "in-memory fallback"],
  ];

  return (
    <div className="grid gap-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-normal text-white">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Manage provider posture, demo RBAC users, and enterprise-ready integration points.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-cyan-200" />
              RBAC Users
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-md border border-white/10 bg-zinc-950/60 p-3">
                <div>
                  <p className="font-medium text-white">{user.name}</p>
                  <p className="text-sm text-zinc-500">{user.email}</p>
                </div>
                <Badge className={user.id === session.id ? "bg-cyan-300/15 text-cyan-100 hover:bg-cyan-300/15" : ""}>
                  {user.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="h-4 w-4 text-cyan-200" />
              Provider Adapters
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {integrations.map(([name, key, status]) => (
              <div key={key} className="flex items-center justify-between rounded-md border border-white/10 bg-zinc-950/60 p-3">
                <div>
                  <p className="font-medium text-white">{name}</p>
                  <p className="text-sm text-zinc-500">{key}</p>
                </div>
                <Badge variant="outline" className="border-emerald-300/30 text-emerald-200">
                  {status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-cyan-200" />
            Security Defaults
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {["Signed HTTP-only sessions", "Tenant-scoped records", "Human-gated tool execution"].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-md border border-white/10 bg-zinc-950/60 p-3 text-sm text-zinc-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              {item}
            </div>
          ))}
        </CardContent>
      </Card>

      <SystemStatus health={health} />

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlugZap className="h-4 w-4 text-cyan-200" />
            Developer Contracts
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row">
          <Button asChild variant="outline" className="justify-start">
            <Link href="/api/health" target="_blank">
              Open health endpoint
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/api/openapi" target="_blank">
              Open OpenAPI spec
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
