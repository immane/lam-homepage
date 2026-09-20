/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@lam/sim-vm", "@lam/desktop", "@lam/finder", "@lam/sim-bridge"],
}

export default nextConfig
