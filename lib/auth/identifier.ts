// Recognises what the person typed in "Email, phone, PIN or alias" (canvas PR02).
export type IdKind = "none" | "email" | "id" | "phone" | "alias";

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
  if (/^(pin)?[\s:#-]*[1-9][0-9]{3,8}$/i.test(t))
    return { kind: "id", tone: "ok", icon: "#", chip: `PIN ${digits} ✓`, hint: "PIN recognised." };
  if (/^pin/i.test(t)) return { kind: "id", tone: "info", icon: "#", chip: "PIN", hint: "A PIN is a number from 1000 up, like 1024." };
  if (/^\+/.test(t) || (/^0/.test(t) && digits.length >= 9))
    return { kind: "phone", tone: "info", icon: "+", chip: "PHONE", hint: "Phone recognised. Codes go to your account email." };
  if (/^[a-z][a-z0-9._-]{2,}$/i.test(t)) return { kind: "alias", tone: "info", icon: "Aa", chip: "ALIAS", hint: "Sign-in alias recognised." };
  return { kind: "none", tone: "neutral", icon: "?", hint: "Enter your email or your PIN." };
}
