/**
 * Link Crawler
 * Recursively discovers URLs by crawling HTML pages and extracting links
 */

import * as cheerio from 'cheerio'

export interface CrawlOptions {
  maxDepth: number
  maxPages: number
  sameDomainOnly: boolean
}

export interface CrawlResult {
  urls: string[]
  totalPages: number
  depth: number
}

/**
 * Crawl a website by discovering links recursively
 */
export async function crawlLinks(
  startUrl: string,
  options: CrawlOptions
): Promise<CrawlResult> {
  const visited = new Set<string>()
  const queue: Array<{ url: string; depth: number }> = [
    { url: startUrl, depth: 0 },
  ]
  const baseDomain = new URL(startUrl).hostname

  while (queue.length > 0 && visited.size < options.maxPages) {
    const { url, depth } = queue.shift()!

    // Skip if already visited or max depth reached
    if (visited.has(url) || depth > options.maxDepth) {
      continue
    }

    visited.add(url)

    // Fetch page and extract links
    try {
      const links = await extractLinksFromPage(url)

      for (const link of links) {
        // Skip if already visited
        if (visited.has(link)) continue

        // Check if same domain
        if (options.sameDomainOnly) {
          const linkDomain = new URL(link).hostname
          if (linkDomain !== baseDomain) continue
        }

        // Add to queue
        queue.push({ url: link, depth: depth + 1 })
      }
    } catch (error) {
      // Skip failed pages
      continue
    }
  }

  return {
    urls: Array.from(visited),
    totalPages: visited.size,
    depth: options.maxDepth,
  }
}

/**
 * Extract all links from an HTML page
 */
async function extractLinksFromPage(url: string): Promise<string[]> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'WebFreezer/1.0 (Website Archiver)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)
  const links: string[] = []

  // Extract all <a href> links
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (href) {
      try {
        // Resolve relative URLs
        const absoluteUrl = new URL(href, url).href
        links.push(absoluteUrl)
      } catch (error) {
        // Skip invalid URLs
      }
    }
  })

  // Deduplicate
  return Array.from(new Set(links))
}
