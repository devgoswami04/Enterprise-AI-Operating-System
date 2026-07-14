"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  Brain,
  BrainCircuit,
  Database,
  Gauge,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SessionUser } from "@/lib/types";

const navItems = [
  { href: "/app", label: "Command", icon: Gauge },
  { href: "/app/knowledge", label: "Knowledge", icon: Database },
  { href: "/app/agents", label: "Agents", icon: Bot },
  { href: "/app/memory", label: "Memory", icon: Brain },
  { href: "/app/workflows", label: "Workflows", icon: Workflow },
  { href: "/app/observability", label: "Observability", icon: Activity },
  { href: "/app/security", label: "Security", icon: ShieldCheck },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function Navigation({ pathname }: { pathname: string }) {
  return (
    <nav className="grid gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/app" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm transition ${
              active
                ? "bg-cyan-300/12 text-cyan-100"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: SessionUser;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/10 bg-zinc-950/95 px-4 py-5 lg:block">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-zinc-950">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Enterprise AI OS</p>
              <p className="text-xs text-zinc-500">NovaWorks workspace</p>
            </div>
          </div>
          <Navigation pathname={pathname} />
          <div className="absolute bottom-5 left-4 right-4 rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{session.avatar}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{session.name}</p>
                <p className="truncate text-xs text-zinc-500">{session.email}</p>
              </div>
              <Badge variant="outline" className="border-cyan-300/30 text-cyan-100">
                {session.role}
              </Badge>
            </div>
          </div>
        </aside>
        <div className="lg:pl-72">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-zinc-950/90 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="border-white/10 bg-zinc-950 text-zinc-100">
                  <SheetHeader>
                    <SheetTitle className="text-left text-white">Enterprise AI OS</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <Navigation pathname={pathname} />
                  </div>
                </SheetContent>
              </Sheet>
              <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-400 md:flex">
                <Search className="h-4 w-4" />
                Ask, search, automate
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/15">
                Mock-safe mode
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={logout}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign out</TooltipContent>
              </Tooltip>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
