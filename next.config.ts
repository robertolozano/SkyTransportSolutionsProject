import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The on-screen dev overlay sits on top of the bottom-left of the UI, which is
  // where the sidebar footer and the first column of every table live. Hidden so
  // screenshots and screen shares show the actual application. Compile and runtime
  // errors are still surfaced.
  devIndicators: false,
}

export default nextConfig
