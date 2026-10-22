import { getT } from "@/lib/i18n/server";

/** Heading shared by Events › My events, Following and Past events. */
export async function EventsHead({ title, line }: { title: string; line: string }) {
  const t = await getT();
  return (
    <div className="mb-5">
      <p className="m-0 text-[13px] text-[#4A5263]">{t("Events")}</p>
      <h1 className="mb-0 mt-1 font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em]">{t(title)}</h1>
      <p className="mb-0 mt-1.5 max-w-[64ch] text-[#4A5263]">{t(line)}</p>
    </div>
  );
}
