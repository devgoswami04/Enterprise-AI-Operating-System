import { Activity, CheckCircle2, CircleDashed, PlugZap, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SystemHealth } from "@/lib/system/health";

const statusConfig = {
  ready: {
    icon: CheckCircle2,
    className: "border-emerald-300/30 text-emerald-200",
  },
  mock: {
    icon: CircleDashed,
    className: "border-cyan-300/30 text-cyan-100",
  },
  missing: {
    icon: XCircle,
    className: "border-amber-300/30 text-amber-200",
  },
  disabled: {
    icon: CircleDashed,
    className: "border-zinc-600 text-zinc-400",
  },
};

export function SystemStatus({ health }: { health: SystemHealth }) {
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-cyan-200" />
          Operational Readiness
        </CardTitle>
        <Badge
          variant="outline"
          className={
            health.status === "ready"
              ? "border-emerald-300/30 text-emerald-200"
              : "border-amber-300/30 text-amber-200"
          }
        >
          {health.status}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {health.checks.map((check) => {
          const Icon = statusConfig[check.status].icon;
          return (
            <div
              key={check.name}
              className="rounded-md border border-white/10 bg-zinc-950/60 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-white">{check.name}</p>
                <Badge variant="outline" className={statusConfig[check.status].className}>
                  <Icon className="mr-1 h-3.5 w-3.5" />
                  {check.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{check.detail}</p>
            </div>
          );
        })}
        <div className="rounded-md border border-white/10 bg-zinc-950/60 p-3 md:col-span-2">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
            <PlugZap className="h-4 w-4 text-cyan-200" />
            API Surface
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {health.routes.map((route) => (
              <code key={route} className="rounded bg-white/[0.04] px-2 py-1 text-xs text-zinc-400">
                {route}
              </code>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
