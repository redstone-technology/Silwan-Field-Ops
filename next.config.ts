import type { NextConfig } from "next";

// The app runs fully in the browser, so it is built as plain files (out/) for Cloudflare.
// ARTIFACT=1 builds the Claude-hosted preview instead: one index.html, hash navigation,
// files loaded by relative path.
const artifact = process.env.ARTIFACT === "1";

const nextConfig: NextConfig = artifact
  ? {
      output: "export",
      assetPrefix: ".",
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_ARTIFACT: "1" },
    }
  : {
      output: "export",
      images: { unoptimized: true },
    };

export default nextConfig;
