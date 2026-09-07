import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SG Calendar",
  description: "Private calendar for two",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-paper text-ink dark:bg-neutral-950 dark:text-neutral-100 transition-colors">
        {children}
      </body>
    </html>
  );
}
