"use client";

import { useActionState } from "react";
import { BrainCircuit, LockKeyhole } from "lucide-react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <Card className="w-full max-w-md border-white/10 bg-zinc-950/80 shadow-2xl shadow-black/40">
      <CardHeader className="space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-2xl">Enterprise AI OS</CardTitle>
          <CardDescription>
            Demo workspace access with signed sessions and RBAC.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue="admin@novaworks.ai"
              autoComplete="email"
              className="bg-zinc-950"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              defaultValue="admin123"
              autoComplete="current-password"
              className="bg-zinc-950"
            />
          </div>
          {state.error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {state.error}
            </p>
          ) : null}
          <Button disabled={pending} className="w-full gap-2">
            <LockKeyhole className="h-4 w-4" />
            {pending ? "Opening workspace..." : "Enter workspace"}
          </Button>
          <div className="grid gap-2 rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400">
            <p>Admin: admin@novaworks.ai / admin123</p>
            <p>Member: member@novaworks.ai / member123</p>
            <p>Viewer: viewer@novaworks.ai / viewer123</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
