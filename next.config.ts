import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", "21.0.4.113"],
};

export default nextConfig;
