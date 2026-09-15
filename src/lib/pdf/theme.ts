// Shared PDF theme — mirrors the brand colors used in lib/emailShell.ts
// (the HTML email shell) so a generated PDF and a notification email look
// like the same product.

export const PDF_ACCENT = "#0d1b2a";
export const PDF_ACCENT_LINE = "#00e676";
export const PDF_TEXT = "#111827";
export const PDF_MUTED = "#6b7280";
export const PDF_BORDER = "#e5e7eb";

export function brandName(): string {
  return process.env.EMAIL_SENDER_NAME?.trim() || "SG-ERP";
}
