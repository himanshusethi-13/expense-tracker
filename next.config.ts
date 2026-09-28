import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js loads its own worker file at runtime, so it must run from node_modules as-is, not bundled.
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    serverActions: {
      // Statement uploads are sent to a Server Action; the default limit is 1 MB and some PDFs are larger.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
