import type { Agent, WorkflowTemplate } from "@/lib/types";

export function getAgentCatalog(organizationId: string): Agent[] {
  return [
    { id: "agent-planner", organizationId, name: "Planner Agent", type: "planner", description: "Breaks enterprise requests into controllable execution plans.", modelPolicy: "mock now, openai/gpt-5.4 via Vercel AI Gateway when enabled", enabled: true },
    { id: "agent-research", organizationId, name: "Research Agent", type: "retrieval", description: "Searches company knowledge and connector metadata.", modelPolicy: "pgvector-backed semantic + lexical retrieval", enabled: true },
    { id: "agent-analyst", organizationId, name: "Analyst Agent", type: "analysis", description: "Extracts risks, KPIs, anomalies, and operational themes.", modelPolicy: "mock now, cloud/local hybrid later", enabled: true },
    { id: "agent-writer", organizationId, name: "Writer Agent", type: "synthesis", description: "Creates cited reports, summaries, and action plans.", modelPolicy: "mock now, provider-routed later", enabled: true },
    { id: "agent-security", organizationId, name: "Security Agent", type: "guardrail", description: "Reviews tool use, prompt injection risk, data scope, and approvals.", modelPolicy: "rules-first guardrail with AI evaluation hooks", enabled: true },
  ];
}

export function getWorkflowCatalog(organizationId: string): WorkflowTemplate[] {
  return [
    {
      id: "workflow-hr-resume", organizationId, name: "HR Candidate Review", category: "HR",
      description: "Summarize resumes, rank candidates, draft interview plans, and schedule follow-ups.", enabled: true,
      steps: [
        { name: "Collect candidate packets", agent: "Research Agent" },
        { name: "Score qualifications", agent: "Analyst Agent" },
        { name: "Draft interview brief", agent: "Writer Agent" },
        { name: "Schedule panel interview", agent: "Workflow Agent", tool: "calendar", approvalRequired: true },
      ],
    },
    {
      id: "workflow-finance-invoice", organizationId, name: "Finance Invoice Audit", category: "Finance",
      description: "Extract invoice data, detect anomalies, create action items, and notify finance owners.", enabled: true,
      steps: [
        { name: "Parse invoices", agent: "Research Agent" },
        { name: "Detect fraud signals", agent: "Analyst Agent" },
        { name: "Create exceptions report", agent: "Writer Agent" },
        { name: "Notify finance channel", agent: "Workflow Agent", tool: "slack", approvalRequired: true },
      ],
    },
    {
      id: "workflow-eng-triage", organizationId, name: "Engineering Bug Triage", category: "Engineering",
      description: "Cluster issues, summarize reproduction notes, create Jira tickets, and prepare release notes.", enabled: true,
      steps: [
        { name: "Group incoming reports", agent: "Planner Agent" },
        { name: "Find related docs", agent: "Research Agent" },
        { name: "Create Jira ticket plan", agent: "Analyst Agent", tool: "jira", approvalRequired: true },
        { name: "Draft release summary", agent: "Writer Agent" },
      ],
    },
    {
      id: "workflow-ops-weekly", organizationId, name: "Operations Weekly Brief", category: "Operations",
      description: "Summarize operational health, open risks, owners, and executive-ready next actions.", enabled: true,
      steps: [
        { name: "Gather ops metrics", agent: "Research Agent" },
        { name: "Prioritize risks", agent: "Analyst Agent" },
        { name: "Generate brief", agent: "Writer Agent" },
        { name: "Share leadership update", agent: "Workflow Agent", tool: "gmail", approvalRequired: true },
      ],
    },
  ];
}

export const SEED_DOCUMENTS = [
  { title: "Q2 Revenue and Risk Review", mimeType: "text/markdown", text: `Q2 revenue grew 18.4 percent quarter over quarter, led by enterprise renewals and a 31 percent increase in workflow automation seats.\nKey risks include elongated procurement cycles, concentration in three strategic accounts, and increased cloud inference cost.\nRecommended actions: expand self-serve onboarding, cap low-value model calls, and assign executive owners to the three largest renewal risks.` },
  { title: "Security and AI Tooling Policy", mimeType: "text/markdown", text: `Employees may use AI agents with company data only inside approved workspaces.\nHigh-risk actions such as sending email, creating public issues, changing calendar invites, or exporting documents require an approval record.\nPrompt injection warnings, sensitive data detection, tool execution logs, and retrieval citations must be visible to administrators.` },
  { title: "Engineering Release Operating Rhythm", mimeType: "text/plain", text: `Engineering teams triage bugs daily, create Jira issues for confirmed defects, and publish weekly release summaries.\nCritical issues require linked source documents, an owner, reproduction notes, customer impact, and rollback guidance.\nAI agents can cluster tickets and draft release notes, but production changes must stay behind human approval.` },
  { title: "HR Interview Loop Playbook", mimeType: "text/plain", text: `Recruiting coordinators prepare candidate briefs with role fit, resume highlights, risks, and recommended interview panels.\nCalendar scheduling should avoid Friday evenings and must include interviewer load balancing.\nAI-generated candidate summaries should cite uploaded resumes or notes and avoid unverified claims.` },
];

export const DEMO_ORG_SEED = { id: "org-nova", name: "NovaWorks Enterprise", slug: "novaworks" };

export const DEMO_USER_SEEDS = [
  { id: "user-admin", email: "admin@novaworks.ai", name: "Ava Chen", role: "admin" as const, avatar: "AC", password: "admin123" },
  { id: "user-member", email: "member@novaworks.ai", name: "Marcus Lee", role: "member" as const, avatar: "ML", password: "member123" },
  { id: "user-viewer", email: "viewer@novaworks.ai", name: "Priya Shah", role: "viewer" as const, avatar: "PS", password: "viewer123" },
];
