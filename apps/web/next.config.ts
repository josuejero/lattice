import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  transpilePackages: ["@lattice/db", "@lattice/shared"],
  webpack(config) {
    const alias = config.resolve?.alias ?? {};
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...alias,
          "@lattice/db": path.resolve(__dirname, "../../packages/db/dist/index.js"),
          "@lattice/shared": path.resolve(__dirname, "../../packages/shared/dist/index.js"),
        },
      },
    };
  },
};

export default nextConfig;
