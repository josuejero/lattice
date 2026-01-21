import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  transpilePackages: ["@lattice/db", "@lattice/shared"],
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@lattice/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@lattice/db": path.resolve(__dirname, "../../packages/db/src/index.ts"),
    };
    return config;
  },
};

export default nextConfig;
