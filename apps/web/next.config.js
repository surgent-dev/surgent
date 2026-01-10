/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@codemirror/state",
    "@codemirror/view",
    "@codemirror/merge",
    "@codemirror/language",
    "@codemirror/lang-javascript",
    "@codemirror/lang-python",
    "@codemirror/lang-css",
    "@codemirror/lang-html",
    "@codemirror/lang-json",
    "@codemirror/lang-markdown",
  ],
}

export default nextConfig
