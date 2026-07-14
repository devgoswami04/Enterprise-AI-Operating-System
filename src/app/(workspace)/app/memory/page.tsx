import { Brain, History, MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireSession } from "@/lib/auth";
import { getRecentMessages, listMemories } from "@/lib/data/store";

export default async function MemoryPage() {
  const session = await requireSession();
  const memories = await listMemories(session.organizationId);
  const messages = await getRecentMessages(session.organizationId);

  return (
    <div className="grid gap-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-normal text-white">Organizational Memory</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Track semantic knowledge, episodic workflow history, and user-specific context that agents can use across sessions.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-cyan-200" />
              Long-Term Memory
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {memories.map((memory) => (
              <div key={memory.id} className="rounded-md border border-white/10 bg-zinc-950/60 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Badge variant="outline" className="border-cyan-300/30 text-cyan-100">
                    {memory.type}
                  </Badge>
                  <span className="text-xs text-zinc-500">
                    importance {memory.importanceScore ?? 50}/100
                  </span>
                </div>
                <p className="text-sm leading-6 text-zinc-300">{memory.content}</p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  {memory.reason ?? "Retained as durable organization context."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                  <span>created {new Date(memory.createdAt).toLocaleString()}</span>
                  {memory.decayAt ? <span>review {new Date(memory.decayAt).toLocaleDateString()}</span> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessagesSquare className="h-4 w-4 text-cyan-200" />
              Short-Term Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {messages.length ? (
              messages.map((message) => (
                <div key={message.id} className="text-sm leading-6 text-zinc-400">
                  <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                    <History className="h-3.5 w-3.5" />
                    {message.role}
                  </div>
                  <p>{message.content}</p>
                  <Separator className="mt-3 bg-white/10" />
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                Ask the AI workspace a question to populate short-term memory.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
