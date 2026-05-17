import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Server Component on /app/page.tsx reads ../templates/Mutual-NDA.md at
  // request time. `output: "standalone"` packages a self-contained server in
  // .next/standalone, and the tracer copies the sibling templates/ directory
  // alongside it. Without `output: "standalone"` the tracing config is inert.
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  outputFileTracingIncludes: {
    "/": ["templates/**/*"],
  },
};

export default nextConfig;
