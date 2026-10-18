// Collects every translation key: literal t("…") calls plus English strings that reach t() indirectly
// (label arrays, server-action messages, PDF-check templates). Usage:
//   node scripts/i18n-keys.mjs            → prints JSON list of keys
//   node scripts/i18n-keys.mjs --missing  → per-locale count of keys without a translation
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = ["app", "components", "lib"];
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(tsx?|mjs)$/.test(f.name) && !p.includes("/i18n/dict/")) files.push(p); } };
SRC.forEach((d) => walk(path.join(ROOT, d)));

const keys = new Set();
const unq = (s) => s.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, "\n");
const litCall = /\bt\(\s*(["'`])((?:\\.|(?!\1).)*?)\1/g;
// Files whose English strings are shown through t(variable): take quoted sentences/labels from them.
const INDIRECT = [/lib\/submission\/actions\.ts$/, /lib\/auth\/.*\.ts$/, /lib\/submission\/steps\.ts$/, /lib\/submission\/pdf-check\.ts$/, /lib\/validation\/auth\.ts$/, /lib\/venues\/types\.ts$/, /lib\/venues\/time\.ts$/];
const LABEL_ARRAYS = /const\s+[A-Z][A-Z_]+\s*(?::[^=]+)?=\s*[[{]/;

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(litCall)) if (m[1] !== "`" || !m[2].includes("${")) keys.add(unq(m[2]));
  const indirect = INDIRECT.some((r) => r.test(f.replace(/\\/g, "/")));
  if (indirect || LABEL_ARRAYS.test(src)) {
    const scope = src;
    if (!indirect) {
      // collect strings inside top-level UPPER_CASE constants only
      const blocks = src.match(/const\s+[A-Z][A-Z_]+\s*(?::[^=]+)?=\s*[[{][\s\S]*?\n[\]}];/g) ?? [];
      for (const b of blocks) for (const m of b.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)) if (/[a-z]{2}/.test(m[1]) && /\s|^[A-Z][a-z]+$/.test(m[1]) && !/^[#/.]|^https?:|^\[|className|^[a-z-]+$|^#[0-9A-F]/i.test(m[1]) && !/^[a-z]+(_[a-z]+)*$/.test(m[1])) keys.add(unq(m[1]));
    } else {
      for (const m of scope.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)) if (/[a-z]{3}/.test(m[1]) && /\s/.test(m[1]) && !/^[a-z0-9_.-]+$|^https?:|select\(|^[a-z_]+,|\*,|\bfrom\b.*\bwhere\b/i.test(m[1]) && !m[1].includes("_") ) keys.add(unq(m[1]));
    }
  }
}
const list = [...keys].filter((k) => k.trim() && /[A-Za-z]/.test(k) && !k.includes("${") && !/\w\(\w+(, \w+)+\)/.test(k) && !/^use (cache|server|client)$/.test(k)).sort();
if (process.argv.includes("--missing")) {
  for (const l of ["fr", "it", "de"]) {
    const src = fs.readFileSync(path.join(ROOT, `lib/i18n/dict/${l}.ts`), "utf8");
    const have = new Set([...src.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:/gm)].map((m) => JSON.parse(m[1])));
    const miss = list.filter((k) => !have.has(k));
    console.log(`${l}: ${list.length - miss.length}/${list.length} translated, ${miss.length} missing`);
    if (process.argv.includes("--list")) console.log(miss.map((k) => "  " + JSON.stringify(k)).join("\n"));
  }
} else console.log(JSON.stringify(list, null, 1));
