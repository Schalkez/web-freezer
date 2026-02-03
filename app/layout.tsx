import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Web Freezer - Archive Websites Offline',
  description: 'Download entire websites for offline browsing. Crawl via sitemap or link discovery.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
