import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Surgent',
    short_name: 'Surgent',
    description: 'AI that builds and grows your business',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [{ src: '/favicon.ico', sizes: '256x256', type: 'image/x-icon' }],
  }
}
