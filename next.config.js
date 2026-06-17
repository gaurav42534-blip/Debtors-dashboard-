const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // Never cache Supabase API calls — always go to network
        urlPattern: /supabase\.co/,
        handler: 'NetworkOnly',
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = withPWA(nextConfig)
