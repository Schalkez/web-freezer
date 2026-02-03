/**
 * URL Rewriter
 * Rewrites URLs in HTML and CSS to point to local files
 */

import * as cheerio from 'cheerio'

export interface URLMapping {
  original: string
  local: string
}

/**
 * Rewrite URLs in HTML to local paths
 */
export function rewriteHTMLUrls(
  html: string,
  urlMappings: Map<string, string>
): string {
  const $ = cheerio.load(html)

  // Rewrite CSS links
  $('link[rel="stylesheet"]').each((_, element) => {
    const href = $(element).attr('href')
    if (href) {
      const localPath = urlMappings.get(href)
      if (localPath) {
        $(element).attr('href', localPath)
      }
    }
  })

  // Rewrite JS scripts
  $('script[src]').each((_, element) => {
    const src = $(element).attr('src')
    if (src) {
      const localPath = urlMappings.get(src)
      if (localPath) {
        $(element).attr('src', localPath)
      }
    }
  })

  // Rewrite images
  $('img[src]').each((_, element) => {
    const src = $(element).attr('src')
    if (src) {
      const localPath = urlMappings.get(src)
      if (localPath) {
        $(element).attr('src', localPath)
      }
    }
  })

  // Rewrite data-src (lazy loading)
  $('img[data-src]').each((_, element) => {
    const dataSrc = $(element).attr('data-src')
    if (dataSrc) {
      const localPath = urlMappings.get(dataSrc)
      if (localPath) {
        $(element).attr('data-src', localPath)
      }
    }
  })

  // Rewrite srcset
  $('img[srcset], source[srcset]').each((_, element) => {
    const srcset = $(element).attr('srcset')
    if (srcset) {
      const rewritten = rewriteSrcset(srcset, urlMappings)
      $(element).attr('srcset', rewritten)
    }
  })

  // Rewrite favicons
  $('link[rel="icon"], link[rel="shortcut icon"]').each((_, element) => {
    const href = $(element).attr('href')
    if (href) {
      const localPath = urlMappings.get(href)
      if (localPath) {
        $(element).attr('href', localPath)
      }
    }
  })

  // Rewrite page links (internal navigation)
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (href) {
      const localPath = urlMappings.get(href)
      if (localPath) {
        $(element).attr('href', localPath)
      }
    }
  })

  return $.html()
}

/**
 * Rewrite URLs in CSS to local paths
 */
export function rewriteCSSUrls(
  css: string,
  urlMappings: Map<string, string>
): string {
  // Replace url() references
  return css.replace(/url\(['"]?([^'"()]+)['"]?\)/g, (match, url) => {
    const localPath = urlMappings.get(url)
    if (localPath) {
      return `url('${localPath}')`
    }
    return match
  })
}

/**
 * Rewrite srcset attribute
 */
function rewriteSrcset(
  srcset: string,
  urlMappings: Map<string, string>
): string {
  const parts = srcset.split(',')
  const rewritten = parts.map((part) => {
    const [url, ...rest] = part.trim().split(/\s+/)
    const localPath = urlMappings.get(url)
    if (localPath) {
      return [localPath, ...rest].join(' ')
    }
    return part
  })

  return rewritten.join(', ')
}

/**
 * Build URL mapping from downloaded assets
 */
export function buildURLMapping(
  assets: Array<{ url: string; localPath: string }>
): Map<string, string> {
  const mapping = new Map<string, string>()

  for (const asset of assets) {
    mapping.set(asset.url, asset.localPath)
  }

  return mapping
}
