'use client'

import { useState } from 'react'

interface CrawlFormProps {
  onSubmit: (data: CrawlFormData) => void
  isLoading: boolean
}

export interface CrawlFormData {
  url: string
  method: 'sitemap' | 'link_discovery'
  maxPages: number
  maxDepth: number
}

export default function CrawlForm({ onSubmit, isLoading }: CrawlFormProps) {
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState<'sitemap' | 'link_discovery'>('sitemap')
  const [maxPages, setMaxPages] = useState(100)
  const [maxDepth, setMaxDepth] = useState(3)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ url, method, maxPages, maxDepth })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* URL Input */}
      <div>
        <label htmlFor="url" className="block text-sm font-medium text-slate-300 mb-2">
          Website URL
        </label>
        <input
          type="url"
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          disabled={isLoading}
          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
      </div>

      {/* Crawl Method */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Crawl Strategy
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setMethod('sitemap')}
            disabled={isLoading}
            className={`p-4 rounded-lg border-2 transition-all ${
              method === 'sitemap'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
            } disabled:opacity-50`}
          >
            <div className="text-2xl mb-2">⚡</div>
            <div className="font-semibold text-white mb-1">Sitemap</div>
            <div className="text-xs text-slate-400">Fast & efficient</div>
          </button>

          <button
            type="button"
            onClick={() => setMethod('link_discovery')}
            disabled={isLoading}
            className={`p-4 rounded-lg border-2 transition-all ${
              method === 'link_discovery'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
            } disabled:opacity-50`}
          >
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-semibold text-white mb-1">Link Discovery</div>
            <div className="text-xs text-slate-400">Thorough crawl</div>
          </button>
        </div>
      </div>

      {/* Advanced Options */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
        >
          {showAdvanced ? '▼' : '▶'} Advanced Options
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            {/* Max Pages */}
            <div>
              <label htmlFor="maxPages" className="block text-sm text-slate-300 mb-2">
                Max Pages: {maxPages}
              </label>
              <input
                type="range"
                id="maxPages"
                min="10"
                max="500"
                step="10"
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                disabled={isLoading}
                className="w-full"
              />
            </div>

            {/* Max Depth (only for link discovery) */}
            {method === 'link_discovery' && (
              <div>
                <label htmlFor="maxDepth" className="block text-sm text-slate-300 mb-2">
                  Max Depth: {maxDepth}
                </label>
                <input
                  type="range"
                  id="maxDepth"
                  min="1"
                  max="5"
                  step="1"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !url}
        className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Crawling...' : 'Freeze Website'}
      </button>
    </form>
  )
}
