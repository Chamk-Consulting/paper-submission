"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DEVICE_ACCOUNTS_KEY, parseAccounts, type DeviceAccount } from "@/lib/auth/device-accounts";
import { useT } from "@/lib/i18n/client";

/* PR03 — "Welcome back": accounts used on this device (stored only with preferences consent). */

const CHANGE = "pl:device-accounts";

function read(): string {
  try {
    return localStorage.getItem(DEVICE_ACCOUNTS_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE, cb);
  window.addEventListener("pl:consent", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("pl:consent", cb);
  };
}

export function useDeviceAccounts(): [DeviceAccount[], (a: DeviceAccount) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const list = useMemo(() => parseAccounts(raw), [raw]);
  const remove = (a: DeviceAccount) => {
    try {
      const next = list.filter((x) => (x.id ?? x.email) !== (a.id ?? a.email));
      if (next.length) localStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(next));
      else localStorage.removeItem(DEVICE_ACCOUNTS_KEY);
    } catch { /* storage blocked */ }
    window.dispatchEvent(new Event(CHANGE));
  };
  return [list, remove];
}

const initialsOf = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
};

export function AccountChooser({ accounts, onPick, onOther, onRemove }: {
  accounts: DeviceAccount[];
  onPick: (a: DeviceAccount) => void;
  onOther: () => void;
  onRemove: (a: DeviceAccount) => void;
}) {
  const t = useT();
  return (
    <>
      <h1 className="mt-7 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("Welcome back")}</h1>
      <p className="mt-2 text-[#4A5263]">{t("Choose an account on this device.")}</p>
      <ul className="m-0 mt-6 flex list-none flex-col gap-2 p-0">
        {accounts.map((a) => (
          <li key={a.id ?? a.email} className="flex items-stretch overflow-hidden rounded-[6px] border border-[#DADDE3] bg-white">
            <button type="button" onClick={() => onPick(a)} className="flex min-w-0 flex-auto items-center gap-3 border-0 bg-transparent px-3.5 py-3 text-left hover:bg-[#F7F8F6]">
              <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full bg-[#E6EDFC] text-[14px] font-semibold text-[#1F47A8]">{initialsOf(a.name)}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[#121826]">{a.name}</span>
                <span className="block truncate font-mono text-[12px] text-[#4A5263]">{a.id ? `${a.id} · ` : ""}{a.email}</span>
              </span>
              <span aria-hidden className="ml-auto text-[#4A5263]">→</span>
            </button>
            <button type="button" onClick={() => onRemove(a)} aria-label={t("Remove {name} from this device", { name: a.name })} title={t("Remove from this device")}
              className="w-11 flex-none border-0 border-l border-[#EEF0EC] bg-transparent text-[17px] text-[#4A5263] hover:bg-[#FDECEA] hover:text-[#B3261E]">×</button>
          </li>
        ))}
        <li>
          <button type="button" onClick={onOther} className="flex w-full items-center gap-3 rounded-[6px] border border-dashed border-[#B7BDC9] bg-transparent px-3.5 py-3 text-left text-[15px] font-medium text-[#121826] hover:bg-white">
            <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full bg-[#EEF0EC] text-[17px] text-[#4A5263]">+</span>
            {t("Use another account")}
          </button>
        </li>
      </ul>
      <p className="mt-5 rounded-[6px] bg-[#EEF0EC] px-3.5 py-2.5 text-[13px] text-[#4A5263]">
        <strong className="text-[#121826]">{t("On a shared computer?")}</strong> {t("Use × to remove your account from this device. We only keep your name, Plenary ID and a hidden email here — never a password.")}
      </p>
    </>
  );
}
