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
};

export default nextConfig;
