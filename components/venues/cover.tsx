import type { CoverFocus, VenueCover as Cover } from "@/lib/venues/types";
import { mediaUrl } from "@/lib/venues/polish-types";

type Field = "control" | "robotics" | "ocean" | "systems" | string | null;

const BG: Record<string, [string, string]> = {
  control: ["#1F47A8", "#0E1B3D"], robotics: ["#C77812", "#5A3606"], ocean: ["#18744F", "#0B3B44"], systems: ["#4A5263", "#121826"],
};
const POS: Record<CoverFocus, string> = {
  "top-left": "0% 0%", top: "50% 0%", "top-right": "100% 0%", left: "0% 50%", center: "50% 50%", right: "100% 50%",
  "bottom-left": "0% 100%", bottom: "50% 100%", "bottom-right": "100% 100%",
};

/** Image source for a cover: an uploaded file in 'venue-media', or a licensed https URL. */
export function coverSrc(c: Cover | null | undefined): string | null {
  if (!c) return null;
  if (c.path) return mediaUrl(c.path);
  if (c.url && /^https:\/\//.test(c.url)) return c.url;
  return null;
}

const W = "rgba(255,255,255,0.42)", W2 = "rgba(255,255,255,0.18)";

/** Default artwork per field, used until the organizers add a cover. Decorative only. */
export function FieldArt({ field }: { field: Field }) {
  const f = (field ?? "systems").toLowerCase();
  const common = { "aria-hidden": true, viewBox: "0 0 220 124", preserveAspectRatio: "xMidYMid slice", className: "absolute inset-0 size-full" } as const;
  if (f === "control") {
    const pts = Array.from({ length: 56 }, (_, i) => { const x = i * 4; const y = 77 - 47 * (1 - Math.exp(-x / 40)) * (1 + 0.5 * Math.sin(x / 13) * Math.exp(-x / 66)); return `${x},${y.toFixed(1)}`; }).join(" ");
    return <svg {...common} fill="none"><path d="M0 30H220" stroke={W2} strokeDasharray="4 4" /><polyline points={pts} stroke={W} strokeWidth={2} /><path d="M0 77H220" stroke={W2} /></svg>;
  }
  if (f === "ocean") {
    return (
      <svg {...common} fill="none">
        {[43, 62, 81, 99].map((y, i) => (
          <path key={y} d={`M0 ${y} ` + Array.from({ length: 8 }, (_, j) => `Q${j * 27.5 + 13.75} ${y - 6 + i * 1.5} ${(j + 1) * 27.5} ${y}`).join(" ")} stroke={i % 2 ? W2 : W} strokeWidth={i % 2 ? 1.5 : 2} />
        ))}
      </svg>
    );
  }
  if (f === "robotics") {
    return (
      <svg {...common} fill="none">
        {Array.from({ length: 11 }, (_, i) => <path key={`v${i}`} d={`M${i * 22} 0V124`} stroke={W2} />)}
        {Array.from({ length: 6 }, (_, i) => <path key={`h${i}`} d={`M0 ${i * 22}H220`} stroke={W2} />)}
        <path d="M40 105L84 56L136 40L163 62" stroke={W} strokeWidth={3} strokeLinecap="round" />
        <circle cx="40" cy="105" r="5" fill={W} /><circle cx="84" cy="56" r="4" fill={W} /><circle cx="136" cy="40" r="4" fill={W} />
      </svg>
    );
  }
  const N: [number, number][] = [[33, 37], [77, 87], [110, 31], [150, 74], [189, 43], [198, 99]];
  const E: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5]];
  return (
    <svg {...common} fill="none">
      {E.map(([a, b]) => <path key={`${a}-${b}`} d={`M${N[a][0]} ${N[a][1]}L${N[b][0]} ${N[b][1]}`} stroke={W2} strokeWidth={1.5} />)}
      {N.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={5} fill={W} />)}
    </svg>
  );
}

/** Cover image (or the field artwork) filling its parent. The parent sets the size and `position: relative`. */
export function VenueCoverImage({ cover, field, alt, priority = false }: { cover: Cover | null | undefined; field: Field; alt: string; priority?: boolean }) {
  const src = coverSrc(cover);
  const [a, b] = BG[(field ?? "systems").toLowerCase()] ?? BG.systems;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- covers come from storage or licensed hosts; sizes vary per venue
    return <img src={src} alt={cover?.alt || alt} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"}
      className="absolute inset-0 size-full object-cover" style={{ objectPosition: POS[cover?.focus ?? "center"] ?? "50% 50%" }} />;
  }
  return (
    <span aria-hidden className="absolute inset-0 block" style={{ background: `linear-gradient(125deg, ${a}, ${b})` }}>
      <FieldArt field={field} />
    </span>
  );
}

export const hasRealCover = (c: Cover | null | undefined) => !!coverSrc(c);
