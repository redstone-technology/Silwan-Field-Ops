import type { NextConfig } from "next";

// ARTIFACT=1 builds a single static page for the Claude-hosted preview:
// one index.html, hash navigation (#board, #alerts…), files loaded by relative path.
const artifact = process.env.ARTIFACT === "1";
// STATIC=1 builds plain files (real routes like /board) for Cloudflare Pages or any static host.
const staticSite = process.env.STATIC === "1";

const nextConfig: NextConfig = staticSite
  ? {
      output: "export",
      images: { unoptimized: true },
    }
  : artifact
  ? {
      output: "export",
      assetPrefix: ".",
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_ARTIFACT: "1" },
    }
  : {
      cacheComponents: true,
      partialPrefetching: true,
    };

export default nextConfig;
