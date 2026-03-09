import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ["mathjax-full"],
  // Note: turbopack.root is commented out for Docker builds as it breaks standalone mode
  // turbopack: {
  //   root: path.resolve(__dirname, ".."),
  // },
  serverExternalPackages: ["lightningcss", "@tailwindcss/postcss", "@tailwindcss/node", "@tailwindcss/oxide"],
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
