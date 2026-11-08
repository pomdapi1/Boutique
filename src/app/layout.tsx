import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";

// Serif proche de celle du logo « Les Songes Créatifs »
const brandFont = Cormorant_Garamond({ weight: ["500", "600"], subsets: ["latin"], variable: "--font-brand-serif" });

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
