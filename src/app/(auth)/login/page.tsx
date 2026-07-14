import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/app");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),linear-gradient(135deg,#050505,#111827_48%,#071018)] text-white">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_420px]">
        <section className="max-w-2xl space-y-8">
          <div className="inline-flex rounded-md border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-cyan-100">
            Multi-agent workspace platform
          </div>
          <div className="space-y-5">
            <h1 className="text-5xl font-semibold leading-tight tracking-normal text-white md:text-6xl">
              Enterprise Brain plus AI Workforce
            </h1>
            <p className="max-w-xl text-lg leading-8 text-zinc-300">
              A production-shaped AI operating system for knowledge search, agent execution,
              workflow automation, organizational memory, and secure observability.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {["RAG with citations", "Human-gated tools", "Agent traces"].map((item) => (
              <div key={item} className="rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-200">
                {item}
              </div>
            ))}
          </div>
        </section>
        <LoginForm />
      </div>
    </main>
  );
}
