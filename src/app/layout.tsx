import type { Metadata } from "next";
import { Anton } from "next/font/google";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });

export const metadata: Metadata = {
  title: "Boutique — Espace admin & créateurs",
  description: "Gestion de la boutique : ventes, stocks, documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={anton.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
