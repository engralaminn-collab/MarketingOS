import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  allowedDevOrigins: ["127.0.0.1","localhost","21.0.4.113","103.231.239.79","marketing.alolabs.net"],
};
export default nextConfig;
