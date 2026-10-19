import type { NextRequest } from "next/server";
import { loadRegistrationDoc } from "@/lib/attend/data";
import { registrationPdf } from "@/lib/attend/document-pdf";

// Invoice / receipt PDF (RG01). registration_document returns data only to the registrant or an organizer.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("r") ?? "";
  const kind = req.nextUrl.searchParams.get("kind") === "receipt" ? "receipt" : "invoice";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const d = await loadRegistrationDoc(id);
  if (!d) return new Response("Not found", { status: 404 });
  const bytes = await registrationPdf(d, kind);
  const name = kind === "invoice" ? (d.invoice_number ?? d.number) : d.number;
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="plenary-${kind}-${name}.pdf"`, "cache-control": "private, no-store" },
  });
}
