"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_POLICY, type PasswordPolicy } from "@/lib/auth/password-rules";

const Ctx = createContext<PasswordPolicy>(DEFAULT_POLICY);

/** The password rules set in Admin, for every password form on the page (root layout). */
export function PasswordPolicyProvider({ policy, children }: { policy: PasswordPolicy; children: ReactNode }) {
  return <Ctx.Provider value={policy}>{children}</Ctx.Provider>;
}

export const usePasswordPolicy = () => useContext(Ctx);
