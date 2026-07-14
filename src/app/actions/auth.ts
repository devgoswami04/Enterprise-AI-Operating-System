"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticateDemoUser, clearSession, createSession } from "@/lib/auth";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginState = {
  error?: string;
};

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const user = await authenticateDemoUser(parsed.data.email, parsed.data.password);
  if (!user) {
    return { error: "Invalid demo credentials." };
  }

  await createSession(user);
  redirect("/app");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
