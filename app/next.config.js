/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: "/ftx/:path*",
        destination: "https://ftx.com/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
