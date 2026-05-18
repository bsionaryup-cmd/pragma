import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a0.muscache.com" },
      { protocol: "https", hostname: "**.muscache.com" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/ical/:propertyId.ics",
        destination: "/api/ical/:propertyId",
      },
    ];
  },
};

export default nextConfig;
