/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@codemirror/state',
    '@codemirror/view',
    '@codemirror/merge',
    '@codemirror/language',
    '@codemirror/lang-javascript',
    '@codemirror/lang-python',
    '@codemirror/lang-css',
    '@codemirror/lang-html',
    '@codemirror/lang-json',
    '@codemirror/lang-markdown',
  ],
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ]
  },
  skipTrailingSlashRedirect: true,
}

export default nextConfig
