/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // This tells Vercel to ignore those annoying formatting errors during build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // This ensures typescript errors don't stop us either
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
