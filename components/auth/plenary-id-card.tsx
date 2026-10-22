import QRCode from "qrcode";
import { getT } from "@/lib/i18n/server";
import { ui } from "@/components/auth/split-layout";
import { CopyIdButton } from "@/components/auth/welcome-client";
import { BadgeDownload } from "@/components/auth/badge-download";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** The Plenary ID card: name, affiliation, ID with copy, QR (ID only) and badge download. Welcome page and Settings › Profile. */
export async function PlenaryIdCard({ name, affiliation, id, orcid, className = "" }: { name: string; affiliation: string | null; id: string | null; orcid?: string | null; className?: string }) {
  const t = await getT();
  const qrSvg = id ? await QRCode.toString(id, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0E1B3D", light: "#FFFFFF" } }) : null;
  return (
    <div id="plenary-id" className={`scroll-mt-24 overflow-hidden rounded-[12px] border border-[#DADDE3] bg-white shadow-[0_1px_2px_rgba(18,24,38,.06),0_8px_24px_rgba(18,24,38,.06)] ${className}`}>
      <div className="h-1.5 bg-[#0E1B3D]" />
      <div className="flex items-center gap-[18px] px-5 py-[18px]">
        <div className="min-w-0 flex-auto">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full bg-[#E6EDFC] text-[14px] font-semibold text-[#1F47A8]">{initials(name)}</span>
            <div className="min-w-0">
              <div className="truncate text-[16px] font-semibold">{name}</div>
              <div className={`truncate text-[13px] ${ui.muted}`}>{affiliation ?? t("Affiliation not set yet")}</div>
            </div>
          </div>
          <div className={`mt-3.5 font-mono text-[11px] tracking-[0.06em] ${ui.muted}`}>{t("PLENARY ID")}</div>
          <div className="flex flex-wrap items-center gap-2">
            {id ? (
              <>
                <span className="font-mono text-[22px] font-medium tracking-[0.04em]">{id}</span>
                <CopyIdButton id={id} />
              </>
            ) : (
              <span className="text-[14px] text-[#7A4508]">{t("Your ID is being issued — refresh in a moment.")}</span>
            )}
          </div>
          {orcid ? <div className={`font-mono text-[12px] ${ui.muted}`}>ORCID {orcid}</div> : null}
        </div>
        {qrSvg ? (
          <figure role="img" aria-label={t("QR code for Plenary ID {id}", { id: id ?? "" })} className="m-0 flex-none rounded-[6px] border border-[#DADDE3] bg-white p-1.5 text-center">
            <div className="size-[105px] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <figcaption className={`mt-1 text-[12px] ${ui.muted}`}>{t("ID only")}</figcaption>
          </figure>
        ) : null}
      </div>
      <div className={`flex flex-wrap justify-between gap-3 border-t border-[#EEF0EC] bg-[#F5F6F3] px-5 py-2.5 text-[12px] ${ui.muted}`}>
        <span>{t("Finds you for co-authors and chairs — never signs you in.")}</span>
        {id && qrSvg ? <BadgeDownload name={name} affiliation={affiliation ?? ""} id={id} orcid={orcid ?? null} qrSvg={qrSvg} /> : null}
      </div>
    </div>
  );
}
