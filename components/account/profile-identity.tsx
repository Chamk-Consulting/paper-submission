"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { AccountState } from "@/lib/account/actions";
import type { NameScript, Profile } from "@/lib/account/data";
import { sx } from "@/components/account/styles";
import { FieldErr } from "@/components/account/save-bar";

/* ST01 Identity+ — names (order, papers, badge, other scripts, other spellings, former names) and research identifiers. */

const small = "inline-flex h-8 items-center whitespace-nowrap rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";
const link = "border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline hover:text-[#1F47A8] disabled:opacity-60";
const tagCls = "rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]";

const LANGS: [string, string][] = [
  ["ar", "Arabic"], ["zh-Hans", "Chinese (Simplified)"], ["zh-Hant", "Chinese (Traditional)"], ["ja", "Japanese"], ["ko", "Korean"],
  ["ru", "Russian / Cyrillic"], ["uk", "Ukrainian"], ["el", "Greek"], ["he", "Hebrew"], ["hi", "Hindi / Devanagari"], ["fa", "Persian"], ["th", "Thai"], ["other", "Other"],
];
const RTL = new Set(["ar", "he", "fa"]);

function Opt({ label }: { label: string }) {
  const t = useT();
  return <span>{t(label)} <span className="font-normal text-[#4A5263]">{t("(optional)")}</span></span>;
}

function initialsOf(first: string, middle: string) {
  return [first, middle].join(" ").split(/[\s-]+/).filter(Boolean).map((w) => `${w[0].toUpperCase()}.`).join(" ");
}

/* ---------------------------------------------------------------- name */
export function NameSection({ p, state, form, onChange }: { p: Profile; state: AccountState; form: string; onChange: () => void }) {
  const t = useT();
  const [given, setGiven] = useState(p.given_name);
  const [middle, setMiddle] = useState(p.middle_name);
  const [family, setFamily] = useState(p.family_name);
  const [order, setOrder] = useState<Profile["name_order"]>(p.name_order);
  const [citation, setCitation] = useState(p.paper_name);
  const [badge, setBadge] = useState(p.badge_name);
  const [scripts, setScripts] = useState<NameScript[]>(p.name_scripts);
  const shown = (order === "family_first" ? `${family} ${given}` : `${given} ${family}`).trim() || "—";
  const auto = `${initialsOf(given, middle)} ${family}`.trim();
  const onPapers = citation.trim() || auto || "—";
  const onBadge = badge.trim() || shown;
  const setScript = (i: number, k: keyof NameScript, v: string) => { setScripts(scripts.map((x, j) => (j === i ? { ...x, [k]: v } : x))); onChange(); };

  return (
    <>
    <section className={sx.card}>
      <h2 className={sx.h2}>{t("Name")}</h2>
      <p className={sx.sub + " text-[13px]"}>{t("Your legal or professional name, as on your papers.")}</p>
      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
        <label className={sx.label}>{t("First name")}
          <input form={form} name="given_name" value={given} onChange={(e) => setGiven(e.target.value)} autoComplete="given-name" required className={sx.input} /><FieldErr state={state} name="given_name" /></label>
        <label className={sx.label}><Opt label="Middle name" />
          <input form={form} name="middle_name" value={middle} onChange={(e) => setMiddle(e.target.value)} autoComplete="additional-name" className={sx.input} /><FieldErr state={state} name="middle_name" /></label>
        <label className={sx.label}>{t("Last name")}
          <input form={form} name="family_name" value={family} onChange={(e) => setFamily(e.target.value)} autoComplete="family-name" required className={sx.input} /><FieldErr state={state} name="family_name" /></label>
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="p-0 text-[14px] font-medium">{t("Name order")}</legend>
          <div className="mt-1.5 flex flex-col gap-1.5 text-[14px]">
            <label className="flex items-center gap-2">
              <input form={form} type="radio" name="name_order" value="given_first" checked={order === "given_first"} onChange={() => setOrder("given_first")} className="size-4 flex-none accent-[#0E1B3D]" />
              <span>{t("First name first")} <span className="text-[#4A5263]">({`${given || t("First")} ${family || t("Last")}`})</span></span>
            </label>
            <label className="flex items-center gap-2">
              <input form={form} type="radio" name="name_order" value="family_first" checked={order === "family_first"} onChange={() => setOrder("family_first")} className="size-4 flex-none accent-[#0E1B3D]" />
              <span>{t("Family name first")} <span className="text-[#4A5263]">({`${family || t("Last")} ${given || t("First")}`})</span></span>
            </label>
          </div>
        </fieldset>
      </div>
      <p className="mb-0 mt-3 rounded-[6px] bg-[#F7F8F6] px-3 py-2 text-[13px] text-[#4A5263]" aria-live="polite">
        {t("Shown as")} <strong className="text-[#121826]">{shown}</strong>
      </p>
    </section>

    <section className={sx.card}>
      <h2 className={sx.h2}>{t("How your name appears")}</h2>
      <p className={sx.sub + " text-[13px]"}>{t("Optional. Leave empty to use your name above.")}</p>
      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
        <label className={sx.label}><Opt label="Name on papers" />
          <input form={form} name="paper_name" value={citation} onChange={(e) => setCitation(e.target.value)} placeholder={auto} className={sx.input} />
          <span className={sx.help}>{t("How you appear in author lists and proceedings.")}</span><FieldErr state={state} name="paper_name" /></label>
        <label className={sx.label}><Opt label="Name on badge" />
          <input form={form} name="badge_name" value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={80} placeholder={shown === "—" ? "" : shown} className={sx.input} />
          <span className={sx.help}>{t("A shorter name for conference badges, if you prefer one.")}</span><FieldErr state={state} name="badge_name" /></label>
        <label className={sx.label}><Opt label="How to say your name" />
          <input form={form} name="name_pronunciation" defaultValue={p.name_pronunciation} maxLength={120} placeholder={t("e.g. AH-mah oh-KAH-for")} className={sx.input} />
          <span className={sx.help}>{t("Session chairs see this when they introduce you.")}</span><FieldErr state={state} name="name_pronunciation" /></label>
        <label className={sx.label}><Opt label="Pronouns" />
          <input form={form} name="pronouns" defaultValue={p.pronouns} maxLength={40} className={sx.input} /></label>
      </div>
      <p className="mb-0 mt-3 rounded-[6px] bg-[#F7F8F6] px-3 py-2 text-[13px] text-[#4A5263]" aria-live="polite">
        {t("On papers")} <strong className="text-[#121826]">{onPapers}</strong> · {t("On badge")} <strong className="text-[#121826]">{onBadge}</strong>
      </p>

    </section>

    <section className={sx.card}>
      <h2 className={sx.h2}>{t("Other names")}</h2>
      <p className={sx.sub + " text-[13px]"}>{t("Used to match your papers and check conflicts of interest.")}</p>
      <h3 className="mb-0 mt-4 text-[15px] font-semibold">{t("Names in other scripts")}</h3>
      <p className={sx.sub + " text-[13px]"}>{t("Shown next to your Latin name in programs. Up to 6.")}</p>
      <div className="mt-2 flex flex-col gap-2.5">
        {scripts.map((x, i) => (
          <div key={i} className="grid gap-2 rounded-[6px] border border-[#EEF0EC] p-2.5 sm:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className={sx.label}>{t("Language")}
              <select form={form} name="script_lang" value={x.lang} onChange={(e) => setScript(i, "lang", e.target.value)} className={sx.input}>
                {LANGS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
              </select>
            </label>
            <label className={sx.label}>{t("Name")}
              <input form={form} name="script_name" value={x.name} onChange={(e) => setScript(i, "name", e.target.value)} maxLength={200}
                dir={RTL.has(x.lang) ? "rtl" : "auto"} lang={x.lang === "other" ? undefined : x.lang} className={sx.input} /></label>
            <label className={sx.label}><Opt label="Latin spelling" />
              <input form={form} name="script_latin" value={x.latin} onChange={(e) => setScript(i, "latin", e.target.value)} maxLength={200} placeholder={t("e.g. Wang Wei")} className={sx.input} /></label>
            <button type="button" className={`${link} justify-self-start pb-2.5 text-[#B3261E]!`} onClick={() => { setScripts(scripts.filter((_, j) => j !== i)); onChange(); }}>
              {t("Remove")}<span className="sr-only"> {x.name}</span>
            </button>
          </div>
        ))}
      </div>
      {scripts.length < 6 ? (
        <button type="button" className={`${small} mt-2`} onClick={() => { setScripts([...scripts, { lang: "other", name: "", latin: "" }]); onChange(); }}>{t("+ Add a name in another script")}</button>
      ) : null}
      <FieldErr state={state} name="name_scripts" />

      <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
        <ChipInput form={form} name="other_names" label="Other spellings on papers" help="e.g. “J. Smith”, “Smith, John A.” — used to match your papers and conflicts." initial={p.other_names} onChange={onChange} />
        <ChipInput form={form} name="former_names" label="Former names" help="Names you published under before. Only used for matching, never shown." initial={p.former_names} onChange={onChange} />
      </div>
      <FieldErr state={state} name="other_names" /> <FieldErr state={state} name="former_names" />
    </section>
    </>
  );
}

function ChipInput({ form, name, label, help, initial, onChange, max = 6 }: { form: string; name: string; label: string; help: string; initial: string[]; onChange: () => void; max?: number }) {
  const t = useT();
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v) || items.length >= max) return;
    setItems([...items, v]); setDraft(""); onChange();
  };
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-[14px] font-medium" htmlFor={`chip-${name}`}>{t(label)} <span className="font-normal text-[#4A5263]">{t("(optional)")}</span></label>
      {items.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {items.map((x) => (
            <li key={x} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#DADDE3] bg-[#F7F8F6] py-0.5 pl-2.5 pr-1 text-[13px]">
              <span className="truncate">{x}</span>
              <button type="button" aria-label={t("Remove {name}", { name: x })} onClick={() => { setItems(items.filter((y) => y !== x)); onChange(); }}
                className="flex size-5 flex-none items-center justify-center rounded-full border-0 bg-transparent text-[#4A5263] hover:bg-[#E9EBE6]">×</button>
              <input form={form} type="hidden" name={name} value={x} />
            </li>
          ))}
        </ul>
      ) : null}
      {items.length < max ? (
        <div className="flex gap-2">
          <input id={`chip-${name}`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={160}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className={`${sx.input} min-w-0 flex-1`} />
          <button type="button" className={`${small} h-[42px]`} onClick={add} disabled={!draft.trim()}>{t("Add")}</button>
        </div>
      ) : null}
      <span className={sx.help}>{t(help)}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- identifiers */
function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 1800);
    return () => clearTimeout(id);
  }, [done]);
  return (
    <button type="button" className={small} onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); } catch { /* clipboard blocked */ } }}>
      <span aria-live="polite">{done ? t("Copied ✓") : t("Copy")}</span>
    </button>
  );
}

type IdKey = "scopus_id" | "researcher_id" | "dblp_url" | "semantic_scholar_id" | "xplore_author_id" | "scholar_url" | "website_url";
const ID_FIELDS: { name: IdKey; label: string; help: string; placeholder: string; url: (v: string) => string; mono?: boolean; inputMode?: "numeric" | "url" }[] = [
  { name: "scopus_id", label: "Scopus Author ID", help: "6–12 digits, from your Scopus author page.", placeholder: "57190000000", url: (v) => `https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(v)}`, mono: true, inputMode: "numeric" },
  { name: "researcher_id", label: "Web of Science ResearcherID", help: "Looks like ABC-1234-2020.", placeholder: "ABC-1234-2020", url: (v) => `https://www.webofscience.com/wos/author/record/${encodeURIComponent(v.toUpperCase())}`, mono: true },
  { name: "dblp_url", label: "DBLP profile", help: "Your dblp.org/pid/… page.", placeholder: "https://dblp.org/pid/12/3456", url: (v) => (/^https:\/\//.test(v) ? v : `https://${v}`), inputMode: "url" },
  { name: "semantic_scholar_id", label: "Semantic Scholar author ID", help: "The number at the end of your author page address.", placeholder: "1741101", url: (v) => `https://www.semanticscholar.org/author/${encodeURIComponent(v)}`, mono: true, inputMode: "numeric" },
  { name: "xplore_author_id", label: "IEEE Xplore author ID", help: "From ieeexplore.ieee.org/author/…", placeholder: "37085000000", url: (v) => `https://ieeexplore.ieee.org/author/${encodeURIComponent(v)}`, mono: true, inputMode: "numeric" },
  { name: "scholar_url", label: "Google Scholar", help: "Your profile address, …/citations?user=…", placeholder: "https://scholar.google.com/citations?user=…", url: (v) => v, inputMode: "url" },
  { name: "website_url", label: "Website", help: "Personal or lab page.", placeholder: "https://", url: (v) => (/^https?:\/\//.test(v) ? v : `https://${v}`), inputMode: "url" },
];

export function IdentifiersSection({ p, state, form }: { p: Profile; state: AccountState; form: string }) {
  const t = useT();
  const [vals, setVals] = useState<Record<IdKey, string>>(() => Object.fromEntries(ID_FIELDS.map((f) => [f.name, p[f.name] ?? ""])) as Record<IdKey, string>);
  const [orcid, setOrcid] = useState(p.orcid ?? "");
  const openLink = (href: string, label: string) => (/^https:\/\/\S+$/.test(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#2F5FD0] underline">{t("open ↗")}<span className="sr-only"> {label}</span></a> : null);
  const orcidBare = orcid.trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, "");
  return (
    <section className={sx.card}>
      <h2 className={sx.h2}>{t("Identifiers")}</h2>
      <p className={sx.sub + " text-[13px]"}>{t("Used to match your papers, fill author lists and find conflicts. All optional except your PIN.")}</p>
      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="text-[14px] font-medium">{t("PIN")}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[17px]">{p.plenary_id ?? "—"}</span>
            {p.plenary_id ? <CopyButton text={p.plenary_id} /> : null}
          </div>
          <span className={sx.help}>{t("Give it to chairs and co-authors instead of your email.")}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pf-orcid" className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
            {t("ORCID")}
            {p.orcid ? (p.orcid_verified
              ? <span className={`${tagCls} bg-[#E1F3EA] text-[#14603F]`}>{t("VERIFIED")}</span>
              : <span className={`${tagCls} bg-[#EEF0EC] text-[#4A5263]`}>{t("NOT VERIFIED")}</span>) : null}
            <span className={`${tagCls} bg-[#EEF0EC] text-[#4A5263]`} title={t("Coming soon")}>{t("Connect · coming soon")}</span>
          </label>
          <input form={form} id="pf-orcid" name={p.orcid_verified ? undefined : "orcid"} value={orcid} onChange={(e) => setOrcid(e.target.value)} disabled={p.orcid_verified}
            placeholder="0000-0002-1825-0097" autoComplete="off" spellCheck={false} className={`${sx.input} font-mono text-[14px] disabled:bg-[#F7F8F6]`} />
          <input form={form} type="hidden" name="orcid_was" value={p.orcid ?? ""} />
          <span className="flex flex-wrap items-center gap-2">
            <span className={sx.help}>{p.orcid_verified ? t("Verified through ORCID.") : t("Type it now — connecting ORCID later will verify it.")}</span>
            {/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(orcidBare) ? openLink(`https://orcid.org/${orcidBare.toUpperCase()}`, "ORCID") : null}
          </span>
          <FieldErr state={state} name="orcid" />
        </div>
        <label className={sx.label}><Opt label="IEEE member number" />
          <input form={form} name="ieee_member" defaultValue={p.ieee_member} inputMode="numeric" maxLength={20} className={`${sx.input} font-mono text-[14px]`} />
          <span className={sx.help}>{t("Used for registration discounts and copyright.")}</span><FieldErr state={state} name="ieee_member" /></label>
        {ID_FIELDS.map((f) => (
          <div key={f.name} className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`pf-${f.name}`} className="text-[14px] font-medium">{t(f.label)} <span className="font-normal text-[#4A5263]">{t("(optional)")}</span></label>
            <input form={form} id={`pf-${f.name}`} name={f.name} value={vals[f.name]} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })} placeholder={f.placeholder}
              inputMode={f.inputMode} autoComplete="off" spellCheck={false} className={`${sx.input} ${f.mono ? "font-mono text-[14px]" : ""}`} />
            <span className="flex flex-wrap items-center gap-2"><span className={sx.help}>{t(f.help)}</span>{vals[f.name].trim() ? openLink(f.url(vals[f.name].trim()), t(f.label)) : null}</span>
            <FieldErr state={state} name={f.name} />
          </div>
        ))}
      </div>
    </section>
  );
}
