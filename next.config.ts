import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-avatar",
      "date-fns",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a0.muscache.com" },
      { protocol: "https", hostname: "**.muscache.com" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  // Dev uses webpack (--webpack in scripts/dev.mjs); production build must match.
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      // Do not spread Next's default ignored — it may include RegExp/empty values
      // that fail webpack schema validation and crash the dev server on first compile.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/hiberfil.sys",
          "**/pagefile.sys",
          "**/swapfile.sys",
          "**/DumpStack.log.tmp",
          "**/System Volume Information/**",
        ],
      };
    }
    return config;
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
