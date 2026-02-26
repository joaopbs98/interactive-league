import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sofifa.net",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  server: {
    proxy: {
      "/api/createLeague": {
        target: "http://localhost:54321/functions/v1/createLeague",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/createLeague/, ""),
      },
    },
  },
};

export default nextConfig;
