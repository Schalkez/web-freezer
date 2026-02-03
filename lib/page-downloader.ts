/**
 * Page Downloader
 * Downloads HTML pages and extracts asset references
 */

import * as cheerio from 'cheerio'
import { normalizeUrl, getAssetType } from './url-utils'

export interface PageAssets {
  css: string[]
  js: string[]
  images: string[]
  fonts: string[]
  other: string[]
}

export interface PageDownloadResult {
  html: string
  assets: PageAssets
  url: string
}

/**
 * Download a page and extract all asset references
 */
export async function downloadPage(url: string): Promise<PageDownloadResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'WebFreezer/1.0 (Website Archiver)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  const html = await response.text()
  const assets = extractAssets(html, url)

  return {
    html,
    assets,
    url,
  }
}

/**
 * Extract all asset references from HTML
 */
function extractAssets(html: string, baseUrl: string): PageAssets {
  const $ = cheerio.load(html)
  const assets: PageAssets = {
    css: [],
    js: [],
    images: [],
    fonts: [],
    other: [],
  }

  // Extract CSS files
  $('link[rel="stylesheet"]').each((_, element) => {
    const href = $(element).attr('href')
    if (href) {
      try {
        const absoluteUrl = normalizeUrl(href, baseUrl)
        assets.css.push(absoluteUrl)
      } catch (error) {
        // Skip invalid URLs
      }
    }
  })

  // Extract JavaScript files
  $('script[src]').each((_, element) => {
    const src = $(element).attr('src')
    if (src) {
      try {
        const absoluteUrl = normalizeUrl(src, baseUrl)
        assets.js.push(absoluteUrl)
      } catch (error) {
        // Skip invalid URLs
      }
    }
  })

  // Extract images
  $('img[src], img[data-src]').each((_, element) => {
    const src = $(element).attr('src') || $(element).attr('data-src')
    if (src) {
      try {
        const absoluteUrl = normalizeUrl(src, baseUrl)
        assets.images.push(absoluteUrl)
      } catch (error) {
        // Skip invalid URLs
      }
    }
  })

  // Extract srcset images
  $('img[srcset], source[srcset]').each((_, element) => {
    const srcset = $(element).attr('srcset')
    if (srcset) {
      const urls = parseSrcset(srcset, baseUrl)
      assets.images.push(...urls)
    }
  })

  // Extract favicons
  $('link[rel="icon"], link[rel="shortcut icon"]').each((_, element) => {
    const href = $(element).attr('href')
    if (href) {
      try {
        const absoluteUrl = normalizeUrl(href, baseUrl)
        assets.images.push(absoluteUrl)
      } catch (error) {
        // Skip invalid URLs
      }
    }
  })

  // Deduplicate
  assets.css = Array.from(new Set(assets.css))
  assets.js = Array.from(new Set(assets.js))
  assets.images = Array.from(new Set(assets.images))
  assets.fonts = Array.from(new Set(assets.fonts))
  assets.other = Array.from(new Set(assets.other))

  return assets
}

/**
 * Parse srcset attribute to extract image URLs
 */
function parseSrcset(srcset: string, baseUrl: string): string[] {
  const urls: string[] = []
  const parts = srcset.split(',')

  for (const part of parts) {
    const url = part.trim().split(/\s+/)[0]
    if (url) {
      try {
        const absoluteUrl = normalizeUrl(url, baseUrl)
        urls.push(absoluteUrl)
      } catch (error) {
        // Skip invalid URLs
      }
    }
  }

  return urls
}
