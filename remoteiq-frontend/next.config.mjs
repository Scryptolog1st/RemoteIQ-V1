// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only HTTP rewrites (no ws://)
  async rewrites() {
    return [
      // Proxy REST API to the Nest backend in dev
      { source: "/api/:path*", destination: "http://localhost:3001/api/:path*" },

      // Serve uploaded files from the backend's static mount
      { source: "/static/:path*", destination: "http://localhost:3001/static/:path*" },
    ];
  },
};

export default nextConfig;
