import { getRuntimeConfig } from "@/modules/shared/env";
import { RetryableError, SecurityError } from "@/modules/shared/errors";

export type ToolExecutionRequest = {
  toolName: string;
  action: string;
  input: Record<string, unknown>;
  dryRun: boolean;
};

export type ToolExecutionResult = {
  provider: string;
  dryRun: boolean;
  message: string;
  reference?: string;
  raw?: Record<string, unknown>;
};

export type ToolAdapter = {
  name: string;
  supports(toolName: string): boolean;
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
};

class MockToolAdapter implements ToolAdapter {
  name = "mock";

  supports() {
    return true;
  }

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    return {
      provider: "mock",
      dryRun: request.dryRun,
      message: `${request.toolName} ${request.action} completed in safe mock mode.`,
      reference: `mock-${crypto.randomUUID()}`,
    };
  }
}

class GitHubToolAdapter implements ToolAdapter {
  name = "github";

  supports(toolName: string) {
    return toolName === "github";
  }

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const config = getRuntimeConfig();
    if (!config.features.liveTools || !config.GITHUB_TOKEN) {
      return new MockToolAdapter().execute({ ...request, dryRun: true });
    }
    if (request.action !== "create_issue") {
      throw new SecurityError("GitHub live adapter only allows create_issue in this MVP.");
    }
    const repository = String(request.input.repository ?? "");
    const title = String(request.input.title ?? "");
    const body = String(request.input.body ?? "");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !title) {
      throw new SecurityError("GitHub action requires repository and title.");
    }
    const response = await fetch(`https://api.github.com/repos/${repository}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body }),
    });
    if (!response.ok) {
      throw new RetryableError("GitHub API request failed", { status: response.status });
    }
    const json = (await response.json()) as { html_url?: string; number?: number };
    return {
      provider: "github",
      dryRun: false,
      message: `GitHub issue #${json.number ?? "unknown"} created.`,
      reference: json.html_url,
      raw: json as Record<string, unknown>,
    };
  }
}

class SlackToolAdapter implements ToolAdapter {
  name = "slack";

  supports(toolName: string) {
    return toolName === "slack";
  }

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const config = getRuntimeConfig();
    if (!config.features.liveTools || !config.SLACK_BOT_TOKEN) {
      return new MockToolAdapter().execute({ ...request, dryRun: true });
    }
    const channel = String(request.input.channel ?? "");
    const text = String(request.input.text ?? request.input.message ?? "");
    if (!channel || !text) {
      throw new SecurityError("Slack action requires channel and text.");
    }
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text }),
    });
    const json = (await response.json()) as { ok?: boolean; ts?: string; error?: string };
    if (!response.ok || !json.ok) {
      throw new RetryableError("Slack API request failed", { status: response.status, error: json.error });
    }
    return {
      provider: "slack",
      dryRun: false,
      message: "Slack message posted.",
      reference: json.ts,
      raw: json as Record<string, unknown>,
    };
  }
}

class CalendarToolAdapter implements ToolAdapter {
  name = "calendar";

  supports(toolName: string) {
    return toolName === "calendar";
  }

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const config = getRuntimeConfig();
    if (!config.features.liveTools || !config.CALENDAR_WEBHOOK_URL) {
      return new MockToolAdapter().execute({ ...request, dryRun: true });
    }
    const response = await fetch(config.CALENDAR_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.input),
    });
    if (!response.ok) {
      throw new RetryableError("Calendar webhook failed", { status: response.status });
    }
    return {
      provider: "calendar",
      dryRun: false,
      message: "Calendar webhook accepted the scheduling request.",
      reference: response.headers.get("x-request-id") ?? undefined,
    };
  }
}

const adapters: ToolAdapter[] = [
  new GitHubToolAdapter(),
  new SlackToolAdapter(),
  new CalendarToolAdapter(),
  new MockToolAdapter(),
];

export function getToolAdapter(toolName: string) {
  return adapters.find((adapter) => adapter.supports(toolName)) ?? adapters.at(-1)!;
}
