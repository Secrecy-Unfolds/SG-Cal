// Shared HTML email shell (branded header/footer) and small helpers, reused
// by both the calendar's email templates and procurement's.

export const ACCENT = "#0d1b2a";
export const ACCENT_LINE = "#00e676";

export function brandName(): string {
  return process.env.EMAIL_SENDER_NAME?.trim() || "SG-ERP";
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function wrap(preheader: string, heading: string, bodyHtml: string): string {
  const brand = escapeHtml(brandName());
  return `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#f2f3f5;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f3f5; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="background:${ACCENT}; padding:22px 32px;">
                <span style="color:#ffffff; font-size:16px; font-weight:700; letter-spacing:0.2px;">${brand}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 18px; font-size:20px; line-height:1.3; color:#111827;">${escapeHtml(heading)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0; background:${ACCENT_LINE}; height:3px; line-height:3px; font-size:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:18px 32px; background:#f9fafb; border-top:1px solid #eef0f2;">
                <p style="margin:0; font-size:12px; color:#9aa0a6;">
                  Sent automatically by ${brand} &middot; times shown in Asia/Muscat
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function introText(text: string): string {
  return `<p style="margin:0 0 18px; font-size:14px; line-height:1.5; color:#4b5563;">${escapeHtml(text)}</p>`;
}
