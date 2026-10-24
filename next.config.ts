import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", "21.0.4.113", "*.e2b.app", "*.e2b.dev"],
};

export default nextConfig;
