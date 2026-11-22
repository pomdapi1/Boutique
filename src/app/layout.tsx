import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Serif proche de celle du logo « Les Songes Créatifs ».
// Fichiers hébergés dans le projet (licence OFL, voir fonts/) : le build ne dépend pas de Google Fonts
// et les navigateurs ne contactent pas Google (RGPD).
const brandFont = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-brand-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Les Songes Créatifs — Espace admin & créateurs",
  description: "Gestion de la boutique de créateurs Les Songes Créatifs : ventes, stocks, documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={brandFont.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
