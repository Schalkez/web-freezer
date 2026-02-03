'use client'

import { useState } from 'react'
import CrawlForm, { type CrawlFormData } from './components/CrawlForm'

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCrawl = async (data: CrawlFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to crawl website')
      }

      // Download ZIP file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${new URL(data.url).hostname}-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              Web Freezer
            </h1>
            <p className="text-xl text-slate-300">
              Archive entire websites for offline browsing
            </p>
          </div>

          {/* Main Form */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 mb-8">
            <CrawlForm onSubmit={handleCrawl} isLoading={isLoading} />

            {/* Error Message */}
            {error && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Sitemap Crawling
              </h3>
              <p className="text-slate-400 text-sm">
                Fast and efficient crawling via sitemap.xml
              </p>
            </div>

            <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
              <div className="text-3xl mb-3">🔍</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Link Discovery
              </h3>
              <p className="text-slate-400 text-sm">
                Recursive crawling to find all pages
              </p>
            </div>

            <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
              <div className="text-3xl mb-3">📦</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Offline Archive
              </h3>
              <p className="text-slate-400 text-sm">
                Download as ZIP with all assets included
              </p>
            </div>

            <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                100% Free
              </h3>
              <p className="text-slate-400 text-sm">
                Runs on Cloudflare Workers free tier
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
