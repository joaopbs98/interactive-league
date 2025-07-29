import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/main/dashboard",
        permanent: true,
      },
    ];
  },
  images: {
    domains: ["cdn.sofifa.net"],
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
