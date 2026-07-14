import { estimateTokens, summarizeText } from "@/lib/ai/chunking";
import { selectModelForTask, type ModelDecision } from "@/lib/ai/model-router";
import { getAIProvider, type AICompletion } from "@/lib/ai/providers";
import {
  recordAgentRun,
  recordChatExchange,
  recordEvaluation,
  recordSecurityEvent,
  searchKnowledge,
  searchToCitations,
} from "@/lib/data/store";
import { evaluateRetrieval, type RetrievalEvaluation } from "@/lib/observability/evaluation";
import { assessInput, type SecurityAssessment } from "@/lib/security/controls";
import type { AgentStep, Citation, SearchResult, SessionUser } from "@/lib/types";
import { runAgentGraph } from "@/modules/agents/state-machine";
import { recallRelevantMemory, writeDurableMemory } from "@/modules/memory/service";
import { createRequestId } from "@/modules/shared/logger";

export type ChatOrchestration = {
  answer: string;
  citations: Citation[];
  steps: Omit<AgentStep, "id" | "organizationId" | "agentRunId" | "createdAt">[];
  runId: string;
  latencyMs: number;
  modelDecision: ModelDecision;
  generation: AICompletion;
  security: SecurityAssessment;
  evaluation: RetrievalEvaluation;
};

type ChatState = {
  rawPrompt: string;
  prompt: string;
  security?: SecurityAssessment;
  searchResults: SearchResult[];
  citations: Citation[];
  modelDecision?: ModelDecision;
  evaluation?: RetrievalEvaluation;
  answer?: string;
  generation?: AICompletion;
  memoryContext: string[];
};

function makeAnswer(prompt: string, citations: Citation[], memoryContext: string[]) {
  if (citations.length === 0) {
    return [
      "I could not find strong supporting evidence in the indexed workspace knowledge.",
      "I can still help plan the task, but I would mark this answer as low-confidence until relevant documents are uploaded.",
    ].join(" ");
  }

  const evidence = citations
    .slice(0, 3)
    .map((citation, index) => `${index + 1}. ${citation.documentTitle}: ${citation.quote}`)
    .join("\n");

  return [
    `Here is the grounded workspace answer for "${prompt}".`,
    "The strongest evidence points to a practical action plan: identify the relevant owner, preserve the cited source trail, and keep external actions behind approval gates.",
    memoryContext.length
      ? `Relevant organizational memory: ${memoryContext.slice(0, 2).join(" ")}`
      : "No high-confidence prior memory changed the answer.",
    "",
    evidence,
    "",
    "Recommended next actions: convert this into a workflow run if execution is needed, or upload more source material if the evidence feels incomplete.",
  ].join("\n");
}

function fallbackGeneration(input: {
  answer: string;
  prompt: string;
  provider: string;
  model: string;
  fallback?: boolean;
  error?: string;
}): AICompletion {
  return {
    text: input.answer,
    provider: input.provider,
    model: input.model,
    latencyMs: 0,
    tokensIn: estimateTokens(input.prompt),
    tokensOut: estimateTokens(input.answer),
    fallback: input.fallback,
    error: input.error,
    finishReason: input.fallback ? "fallback" : "deterministic",
  };
}

function buildGroundedGenerationPrompt(prompt: string, citations: Citation[], memoryContext: string[]) {
  const evidence = citations.length
    ? citations
        .slice(0, 6)
        .map(
          (citation, index) =>
            `[${index + 1}] ${citation.documentTitle} (score ${citation.score}): ${citation.quote}`,
        )
        .join("\n")
    : "No indexed evidence was retrieved. Say that confidence is low and ask for more source material.";

  const memory = memoryContext.length ? memoryContext.join("\n") : "No relevant durable memory.";

  return [
    `User request: ${prompt}`,
    "",
    "Retrieved evidence:",
    evidence,
    "",
    "Relevant organizational memory:",
    memory,
    "",
    "Write a concise enterprise answer grounded only in the evidence above. Include source markers like [1] when evidence is used. If the evidence is insufficient, say so directly. Do not propose external tool execution unless it is behind approval.",
  ].join("\n");
}

export async function orchestrateChat(session: SessionUser, prompt: string): Promise<ChatOrchestration> {
  const started = Date.now();
  const requestId = createRequestId("chat");
  const graph = await runAgentGraph<ChatState>(
    {
      rawPrompt: prompt,
      prompt,
      searchResults: [],
      citations: [],
      memoryContext: [],
    },
    [
      {
        name: "Security Agent",
        retry: { attempts: 2, backoffMs: 25 },
        run: (state) => {
          const security = assessInput(state.rawPrompt);
          return {
            state: { ...state, prompt: security.sanitizedInput, security },
            status: security.riskLevel === "high" ? "waiting_approval" : "completed",
            summary:
              security.riskLevel === "high"
                ? "Detected prompt-injection language. External tools remain blocked."
                : security.findings.length
                  ? `Applied controls: ${security.findings.join(", ")}.`
                  : "Prompt passed security policy for knowledge-only processing.",
            output: { riskLevel: security.riskLevel, findings: security.findings },
          };
        },
      },
      {
        name: "Planner Agent",
        run: (state) => ({
          state,
          summary: `Planned a retrieval-first response path for ${estimateTokens(state.prompt)} input tokens.`,
          output: {
            subgoals: ["assess prompt", "retrieve evidence", "recall memory", "rank evidence", "write cited answer"],
          },
        }),
      },
      {
        name: "Model Router",
        run: (state) => {
          const modelDecision = selectModelForTask({
            objective: state.prompt,
            riskLevel: state.security?.riskLevel,
            requiresSynthesis: estimateTokens(state.prompt) > 300,
          });
          return {
            state: { ...state, modelDecision },
            summary: `${modelDecision.model} selected. ${modelDecision.reason}`,
            output: modelDecision,
          };
        },
      },
      {
        name: "Research Agent",
        retry: { attempts: 2, backoffMs: 50 },
        run: (state) => {
          const searchResults = searchKnowledge(session.organizationId, state.prompt, 5);
          const citations = searchToCitations(searchResults);
          return {
            state: { ...state, searchResults, citations },
            summary: `Retrieved ${citations.length} cited workspace passages from indexed knowledge.`,
            output: { citations: citations.length, topScore: searchResults[0]?.score ?? 0 },
          };
        },
      },
      {
        name: "Memory Agent",
        run: (state) => {
          const recalled = recallRelevantMemory({
            organizationId: session.organizationId,
            query: state.prompt,
            limit: 3,
            requestId,
          });
          return {
            state: {
              ...state,
              memoryContext: recalled.map(({ memory }) => summarizeText(memory.content, 140)),
            },
            summary: `Recalled ${recalled.length} relevant organizational memories.`,
            output: { memories: recalled.map(({ memory, score }) => ({ id: memory.id, score: Number(score.toFixed(3)) })) },
          };
        },
      },
      {
        name: "Analyst Agent",
        run: (state) => ({
          state,
          summary:
            state.citations.length > 0
              ? `Ranked evidence. Top match: ${summarizeText(state.citations[0].quote, 90)}`
              : "No sufficiently strong internal evidence found.",
          output: { rankedCitations: state.citations.map((citation) => citation.documentId) },
        }),
      },
      {
        name: "Evaluation Agent",
        run: (state) => {
          const evaluation = evaluateRetrieval(state.searchResults, state.citations);
          return {
            state: { ...state, evaluation },
            summary: `Retrieval quality ${evaluation.retrievalQuality}/100 with ${evaluation.hallucinationRisk} hallucination risk.`,
            output: evaluation,
          };
        },
      },
      {
        name: "Writer Agent",
        timeoutMs: 20_000,
        run: async (state) => {
          const provider = getAIProvider();
          const deterministicAnswer = makeAnswer(state.prompt, state.citations, state.memoryContext);
          const modelDecision =
            state.modelDecision ??
            selectModelForTask({
              objective: state.prompt,
              riskLevel: state.security?.riskLevel,
              requiresSynthesis: estimateTokens(state.prompt) > 300,
            });

          if (provider.mode === "live" && state.security?.riskLevel !== "high") {
            try {
              const generation = await provider.complete(
                buildGroundedGenerationPrompt(state.prompt, state.citations, state.memoryContext),
                {
                  system:
                    "You are the Writer Agent in an enterprise AI operating system. Produce grounded, auditable, citation-aware answers. Never invent citations or claim unsupported facts.",
                  model: modelDecision.model,
                  maxOutputTokens: 900,
                  organizationId: session.organizationId,
                  requestId,
                  userId: session.id,
                },
              );
              const answer = generation.text || deterministicAnswer;
              return {
                state: { ...state, answer, generation },
                summary: `Composed a cited response with ${generation.provider}/${generation.model}.`,
                output: {
                  answerTokens: generation.tokensOut,
                  citationCount: state.citations.length,
                  provider: generation.provider,
                  model: generation.model,
                  latencyMs: generation.latencyMs,
                },
              };
            } catch (error) {
              const message = error instanceof Error ? error.message : "Live provider failed";
              const generation = fallbackGeneration({
                answer: deterministicAnswer,
                prompt: state.prompt,
                provider: provider.name,
                model: modelDecision.model,
                fallback: true,
                error: message,
              });
              return {
                state: { ...state, answer: deterministicAnswer, generation },
                summary: `Live provider failed; used deterministic grounded fallback: ${message}`,
                output: {
                  answerTokens: estimateTokens(deterministicAnswer),
                  citationCount: state.citations.length,
                  provider: generation.provider,
                  model: generation.model,
                  fallback: true,
                },
              };
            }
          }

          const generation = fallbackGeneration({
            answer: deterministicAnswer,
            prompt: state.prompt,
            provider: provider.name,
            model: provider.model,
            fallback: provider.mode === "mock",
          });
          return {
            state: { ...state, answer: deterministicAnswer, generation },
            summary:
              state.security?.riskLevel === "high"
                ? "Composed a deterministic response because elevated security risk blocks live provider calls."
                : "Composed a cited response with deterministic mock-safe generation.",
            output: {
              answerTokens: estimateTokens(deterministicAnswer),
              citationCount: state.citations.length,
              provider: generation.provider,
              model: generation.model,
            },
          };
        },
      },
    ],
    {
      organizationId: session.organizationId,
      userId: session.id,
      requestId,
    },
  );

  const security = graph.state.security ?? assessInput(prompt);
  const citations = graph.state.citations;
  const modelDecision =
    graph.state.modelDecision ??
    selectModelForTask({ objective: security.sanitizedInput, riskLevel: security.riskLevel });
  const evaluation = graph.state.evaluation ?? evaluateRetrieval(graph.state.searchResults, citations);
  const answer = graph.state.answer ?? makeAnswer(security.sanitizedInput, citations, graph.state.memoryContext);
  const generation =
    graph.state.generation ??
    fallbackGeneration({
      answer,
      prompt: security.sanitizedInput,
      provider: modelDecision.provider,
      model: modelDecision.model,
      fallback: true,
    });
  const latencyMs = Date.now() - started;
  const steps = graph.steps;

  const run = recordAgentRun({
    organizationId: session.organizationId,
    objective: security.sanitizedInput,
    steps,
    status: steps.some((step) => step.status === "failed")
      ? "failed"
      : security.riskLevel === "high"
        ? "waiting_approval"
        : "completed",
    modelUsed: generation.model,
    providerUsed: generation.provider,
    tokensIn: generation.tokensIn,
    tokensOut: generation.tokensOut,
  });

  recordChatExchange({
    organizationId: session.organizationId,
    userId: session.id,
    prompt: security.sanitizedInput,
    answer,
    citations,
    latencyMs,
  });

  writeDurableMemory({
    organizationId: session.organizationId,
    userId: session.id,
    type: "episodic",
    content: `Agent run ${run.id} answered "${security.sanitizedInput}" using ${citations.length} citations with ${evaluation.hallucinationRisk} risk.`,
    reason: "Agent run generated a reusable execution/evaluation summary.",
    importanceScore: Math.min(100, 48 + citations.length * 10 + (security.riskLevel === "high" ? 20 : 0)),
    requestId,
  });

  if (security.findings.length) {
    recordSecurityEvent({
      organizationId: session.organizationId,
      actorUserId: session.id,
      riskLevel: security.riskLevel,
      findings: security.findings,
      action: "chat.input_assessed",
      targetType: "agent_run",
      targetId: run.id,
    });
  }

  recordEvaluation({
    organizationId: session.organizationId,
    targetType: "chat",
    targetId: run.id,
    groundedness: evaluation.groundedness,
    citationCoverage: evaluation.citationCoverage,
    retrievalQuality: evaluation.retrievalQuality,
    hallucinationRisk: evaluation.hallucinationRisk,
    notes: evaluation.notes,
  });

  return {
    answer,
    citations,
    steps,
    runId: run.id,
    latencyMs,
    modelDecision,
    generation,
    security,
    evaluation,
  };
}

export function toSse(data: unknown, event?: string) {
  const prefix = event ? `event: ${event}\n` : "";
  return `${prefix}data: ${JSON.stringify(data)}\n\n`;
}
