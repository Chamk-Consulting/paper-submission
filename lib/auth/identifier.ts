// Recognises what the person typed in "Email, phone, Plenary ID or alias" (canvas PR02).
export type IdKind = "none" | "email" | "id" | "phone" | "pin" | "alias";

export type Detected = {
  kind: IdKind;
  tone: "neutral" | "info" | "ok" | "warn";
  icon: string;
  chip?: string;
  hint: string;
};

export function detectIdentifier(value: string): Detected {
  const t = (value || "").trim();
  const digits = t.replace(/[^0-9]/g, "");
  if (!t) return { kind: "none", tone: "neutral", icon: "?", hint: "Use whichever you remember — we’ll recognise it." };
  if (t.indexOf("@") > 0) return { kind: "email", tone: "info", icon: "@", chip: "EMAIL", hint: "Email recognised." };
  if (/^pl/i.test(t) || (digits.length === 8 && /^[0-9-]+$/.test(t))) {
    if (digits.length === 8)
      return { kind: "id", tone: "ok", icon: "ID", chip: `PL-${digits.slice(0, 4)}-${digits.slice(4)} ✓`, hint: "Plenary ID recognised." };
    return { kind: "id", tone: "info", icon: "ID", chip: "PLENARY ID", hint: "Plenary IDs have 8 digits, like PL-4821-0937." };
  }
  if (/^\+/.test(t) || (/^0/.test(t) && digits.length >= 9))
    return { kind: "phone", tone: "info", icon: "+", chip: "PHONE", hint: "Phone recognised. Codes go to your account email." };
  if (/^[0-9]{4,7}$/.test(t))
    return { kind: "pin", tone: "warn", icon: "#", chip: "OLD PIN?", hint: "Plenary doesn’t use PaperCept PINs to sign in." };
  if (/^[a-z][a-z0-9._-]{2,}$/i.test(t)) return { kind: "alias", tone: "info", icon: "Aa", chip: "ALIAS", hint: "Sign-in alias recognised." };
  return { kind: "none", tone: "neutral", icon: "?", hint: "Enter an email, a phone with country code, a Plenary ID or your alias." };
}
