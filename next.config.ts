import type { NextConfig } from "next";
import path from "node:path";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Politique de sécurité du contenu : tout vient du site lui-même (polices auto-hébergées,
 * aucun script tiers). 'unsafe-inline' reste nécessaire pour les scripts d'hydratation
 * de Next.js ; 'unsafe-eval' uniquement en développement (rechargement à chaud).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Interdit l'affichage du site dans une iframe (clickjacking) — doublon de frame-ancestors pour les vieux navigateurs
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // HTTPS obligatoire pendant 1 an (ignoré par les navigateurs tant que le site est servi en HTTP)
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer"],
  // pdfkit charge ses polices standard dynamiquement : le traçage du build
  // standalone ne les détecte pas, on les inclut explicitement.
  outputFileTracingIncludes: {
    "**": ["./node_modules/pdfkit/js/**/*", "./node_modules/@react-pdf/**/*"],
  },
  experimental: {
    // Les documents font 2 Mo max : on laisse une marge pour l'encodage multipart.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
