// Absolute base URL for links embedded in outbound content (emails, PDFs)
// that need to work outside an authenticated browser session — e.g. the
// public invoice-PDF share link. Prefers an explicit APP_BASE_URL (set it
// if you're on a custom domain); falls back to Vercel's own deployment URL
// (VERCEL_URL, no protocol) in production, or localhost in dev.
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}
