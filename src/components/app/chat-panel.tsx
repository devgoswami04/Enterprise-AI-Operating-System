"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { Citation } from "@/lib/types";

type ChatEntry = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  evaluation?: {
    retrievalQuality: number;
    hallucinationRisk: "low" | "medium" | "high";
  };
  model?: string;
  securityFindings?: string[];
};

type StepEntry = {
  agentName: string;
  summary: string;
  status: string;
};

function parseSseBlocks(buffer: string) {
  const blocks = buffer.split("\n\n");
  return {
    complete: blocks.slice(0, -1),
    rest: blocks.at(-1) ?? "",
  };
}

export function ChatPanel({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState("Summarize key Q2 risks and recommended actions.");
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      role: "assistant",
      content:
        "Ask about company knowledge, workflows, policies, risks, or execution plans. I will answer with citations when evidence exists.",
    },
  ]);
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [streaming, setStreaming] = useState(false);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || streaming) {
      return;
    }

    setMessages((current) => [...current, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setSteps([]);
    setPrompt("");
    setStreaming(true);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok || !response.body) {
      setMessages((current) => [
        ...current.slice(0, -1),
        { role: "assistant", content: "The chat service could not start. Check your session and try again." },
      ]);
      setStreaming(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseBlocks(buffer);
      buffer = parsed.rest;

      for (const block of parsed.complete) {
        const eventName = block
          .split("\n")
          .find((line) => line.startsWith("event: "))
          ?.replace("event: ", "");
        const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine) {
          continue;
        }
        const data = JSON.parse(dataLine.replace("data: ", ""));

        if (eventName === "step") {
          setSteps((current) => [...current, data.step]);
        }

        if (eventName === "token") {
          setMessages((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: `${last.content}${data.token}` };
            return next;
          });
        }

        if (eventName === "done") {
          setMessages((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            next[next.length - 1] = {
              ...last,
              citations: data.citations,
              evaluation: data.evaluation,
              model: data.generation?.model ?? data.modelDecision?.model,
              securityFindings: data.security?.findings,
            };
            return next;
          });
        }
      }
    }

    setStreaming(false);
  }

  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-cyan-200" />
          AI Workspace
        </CardTitle>
        <Badge variant="outline" className="border-cyan-300/30 text-cyan-100">
          RAG + agents
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ScrollArea className={compact ? "h-[320px]" : "h-[430px]"}>
          <div className="space-y-4 pr-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-md border p-3 ${
                  message.role === "assistant"
                    ? "border-cyan-300/15 bg-cyan-300/[0.04]"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                  {message.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : null}
                  {message.role}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{message.content}</p>
                {message.model || message.evaluation || message.securityFindings?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.model ? (
                      <Badge variant="outline" className="border-cyan-300/30 text-cyan-100">
                        {message.model}
                      </Badge>
                    ) : null}
                    {message.evaluation ? (
                      <>
                        <Badge variant="outline" className="border-emerald-300/30 text-emerald-200">
                          retrieval {message.evaluation.retrievalQuality}/100
                        </Badge>
                        <Badge variant="outline" className="border-white/10 text-zinc-400">
                          {message.evaluation.hallucinationRisk} risk
                        </Badge>
                      </>
                    ) : null}
                    {message.securityFindings?.map((finding) => (
                      <Badge key={finding} variant="outline" className="border-amber-300/30 text-amber-200">
                        {finding}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {message.citations?.length ? (
                  <div className="mt-3 grid gap-2">
                    {message.citations.map((citation) => (
                      <div key={`${citation.documentId}-${citation.score}`} className="rounded-md border border-white/10 bg-zinc-950/60 p-2 text-xs text-zinc-400">
                        <span className="text-cyan-100">{citation.documentTitle}</span> - score {citation.score}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </ScrollArea>
        {steps.length ? (
          <div className="grid gap-2 rounded-md border border-white/10 bg-zinc-950/60 p-3">
            {steps.slice(-5).map((step, index) => (
              <div key={`${step.agentName}-${index}`} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
                <span>
                  <span className="text-zinc-200">{step.agentName}</span>: {step.summary}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <form onSubmit={sendMessage} className="grid gap-3">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask a cited question or request an execution plan..."
            className="min-h-24 resize-none bg-zinc-950"
          />
          <Button disabled={streaming || !prompt.trim()} className="justify-self-end gap-2">
            <Send className="h-4 w-4" />
            {streaming ? "Thinking..." : "Send"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
