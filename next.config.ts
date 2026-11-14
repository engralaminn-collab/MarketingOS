import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "21.0.4.113",
    "103.231.239.79",
    "marketing.alolabs.net",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  experimental: {
    optimizePackageImports: [
      "@radix-ui/react-icons",
      "lucide-react",
      "@heroicons/react",
    ],
  },
};

export default nextConfig;
