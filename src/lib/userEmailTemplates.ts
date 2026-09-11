import { escapeHtml, introText, wrap } from "@/lib/emailShell";

export function passwordResetEmail(who: string, tempPassword: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const passwordBlock = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      <tr>
        <td style="padding:14px 18px; background:#f9fafb; border:1px solid #eef0f2; border-radius:8px; text-align:center;">
          <span style="font-family:ui-monospace,Consolas,monospace; font-size:18px; font-weight:700; letter-spacing:1px; color:#111827;">${escapeHtml(
            tempPassword
          )}</span>
        </td>
      </tr>
    </table>`;

  return {
    subject: "Your password has been reset",
    html: wrap(
      "Your password has been reset — here's your new temporary one",
      "Password reset",
      introText(`${whoSafe} (a Super Admin) reset your password. Your new temporary password is:`) +
        passwordBlock +
        introText("Sign in with it, then change it right away from Change Password on your Profile page.")
    ),
  };
}
