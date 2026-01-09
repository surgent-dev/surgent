/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["opencode"],
  typescript: {
    // opencode package type-checks itself with its own tsconfig
    ignoreBuildErrors: true,
  },
}

export default nextConfig
