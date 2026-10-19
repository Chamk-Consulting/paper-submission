import "server-only";
import { createHash } from "node:crypto";
import QRCode from "qrcode";
import { hashToken } from "@/lib/tokens";

/*
 * Badge check-in token (BD01). The database keeps a random salt per registration and only the sha256 hash of the token
 * (see private.badge_token in 20261019002100_attend.sql). The same token is derived here for the registration's owner
 * and for organizers, so a printed badge and the badge on a phone carry the same QR. "Reissue" changes the salt.
 */
const PREFIX = "PLN1:";

export function badgeToken(registrationId: string, salt: string): string {
  return createHash("sha256").update(`plenary-badge:${salt}:${registrationId}`).digest("hex").slice(0, 32);
}

export const badgePayload = (registrationId: string, salt: string) => PREFIX + badgeToken(registrationId, salt);

/** What a scanner (or a person typing) gave us → the hash the desk looks up, or null if it isn't a badge code. */
export function scanToHash(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/^(?:PLN1:)?([0-9a-f]{32})$/i);
  return m ? hashToken(m[1].toLowerCase()) : null;
}

/** QR code as an SVG string (dark modules in ink, quiet zone included). */
export async function qrSvg(text: string, size = 150): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: size, color: { dark: "#0E1B3DFF", light: "#FFFFFFFF" } });
  return svg.replace("<svg ", `<svg role="img" aria-label="QR code" focusable="false" `);
}

export type BadgeRole = "staff" | "chair" | "presenter" | "author" | "attendee";
export const RIBBON: Record<BadgeRole, { label: string; bg: string; ink: string }> = {
  presenter: { label: "AUTHOR · PRESENTER", bg: "#F2A93B", ink: "#0E1B3D" },
  author: { label: "AUTHOR", bg: "#F2A93B", ink: "#0E1B3D" },
  chair: { label: "SESSION CHAIR", bg: "#2F5FD0", ink: "#FFFFFF" },
  attendee: { label: "ATTENDEE", bg: "#EEF0EC", ink: "#121826" },
  staff: { label: "STAFF", bg: "#18744F", ink: "#FFFFFF" },
};

export type Badge = {
  id: string; number: string; full_name: string | null; affiliation: string | null; reg_type: string; salt: string; paid: boolean; status: string;
  checked_in_at: string | null; plenary_id: string | null; role: BadgeRole;
};
