import { card, h2 } from "@/components/submission/shell";

/** "What happens next" numbered list used on the done screens (SB10c, SB11c, SB12f, SB14d). Pass translated text. */
export function NextSteps({ title, doneLabel, items }: { title: string; doneLabel: string; items: { title: string; text: string; done?: boolean }[] }) {
  return (
    <section className={`${card} mt-6`}>
      <h2 className={h2}>{title}</h2>
      <ol className="m-0 mt-4 flex list-none flex-col gap-4 p-0">
        {items.map((it, i) => (
          <li key={it.title} className="flex gap-3">
            {it.done
              ? <span className="flex size-7 flex-none items-center justify-center rounded-full bg-[#18744F] text-[12px] text-white" aria-label={doneLabel}>✓</span>
              : <span className="box-border flex size-7 flex-none items-center justify-center rounded-full border-[1.5px] border-[#B7BDC9] text-[13px] text-[#4A5263]">{i + 1}</span>}
            <span><span className="block font-semibold">{it.title}</span><span className="block text-[15px] text-[#4A5263]">{it.text}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
