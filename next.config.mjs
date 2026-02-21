/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.module.rules.push(
      {
        test: /pdf\.worker\.(min\.)?m?js$/,
        type: "asset/resource",
      },
      {
        test: /pdf\.worker\.min\.js$/,
        type: "asset/resource",
      }
    );
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      canvas: false,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
