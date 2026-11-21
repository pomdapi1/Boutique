import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
  // pdfkit charge ses polices standard dynamiquement : le traçage du build
  // standalone ne les détecte pas, on les inclut explicitement.
  outputFileTracingIncludes: {
    "**": ["./node_modules/pdfkit/js/**/*", "./node_modules/@react-pdf/**/*"],
  },
  experimental: {
    // Les documents font 2 Mo max : on laisse une marge pour l'encodage multipart.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
