/**
 * Sitemap Parser
 * Fetches and parses sitemap.xml to extract all URLs from a domain
 */

import { parseStringPromise } from 'xml2js'

export interface SitemapURL {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: string
}

export interface SitemapParseResult {
  urls: string[]
  method: 'sitemap' | 'sitemap_index' | 'none'
  error?: string
}

/**
 * Fetch and parse sitemap.xml from a domain
 */
export async function parseSitemap(
  domain: string
): Promise<SitemapParseResult> {
  const baseUrl = normalizeUrl(domain)

  // Try common sitemap locations
  const sitemapUrls = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap.xml.gz`,
  ]

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'WebFreezer/1.0 (Website Archiver)',
        },
      })

      if (!response.ok) continue

      const xml = await response.text()
      const parsed = await parseStringPromise(xml)

      // Check if it's a sitemap index (contains other sitemaps)
      if (parsed.sitemapindex) {
        const sitemaps = parsed.sitemapindex.sitemap || []
        const allUrls: string[] = []

        // Fetch all nested sitemaps
        for (const sitemap of sitemaps) {
          const nestedUrl = sitemap.loc[0]
          const nestedResult = await fetchSitemapUrls(nestedUrl)
          allUrls.push(...nestedResult)
        }

        return {
          urls: allUrls,
          method: 'sitemap_index',
        }
      }

      // Regular sitemap
      if (parsed.urlset) {
        const urls = extractUrlsFromSitemap(parsed.urlset)
        return {
          urls,
          method: 'sitemap',
        }
      }
    } catch (error) {
      // Continue to next sitemap URL
      continue
    }
  }

  // No sitemap found
  return {
    urls: [],
    method: 'none',
    error: 'No sitemap.xml found',
  }
}

/**
 * Fetch URLs from a single sitemap
 */
async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'WebFreezer/1.0 (Website Archiver)',
      },
    })

    if (!response.ok) return []

    const xml = await response.text()
    const parsed = await parseStringPromise(xml)

    if (parsed.urlset) {
      return extractUrlsFromSitemap(parsed.urlset)
    }

    return []
  } catch (error) {
    return []
  }
}

/**
 * Extract URLs from parsed sitemap XML
 */
function extractUrlsFromSitemap(urlset: any): string[] {
  const urls: string[] = []

  if (urlset.url && Array.isArray(urlset.url)) {
    for (const url of urlset.url) {
      if (url.loc && url.loc[0]) {
        urls.push(url.loc[0])
      }
    }
  }

  return urls
}

/**
 * Normalize URL to base domain
 */
function normalizeUrl(url: string): string {
  // Remove trailing slash
  url = url.replace(/\/$/, '')

  // Add https:// if no protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }

  return url
}
