/**
 * URL Utilities
 * Helper functions for URL manipulation and validation
 */

/**
 * Normalize URL to absolute path
 */
export function normalizeUrl(url: string, baseUrl?: string): string {
  try {
    // If URL is already absolute, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }

    // If base URL provided, resolve relative URL
    if (baseUrl) {
      return new URL(url, baseUrl).href
    }

    // Add https:// if no protocol
    if (!url.startsWith('//')) {
      return `https://${url}`
    }

    return `https:${url}`
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`)
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`)
  }
}

/**
 * Check if two URLs are from the same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  try {
    const domain1 = extractDomain(url1)
    const domain2 = extractDomain(url2)
    return domain1 === domain2
  } catch (error) {
    return false
  }
}

/**
 * Convert URL to local file path
 */
export function urlToFilePath(url: string, baseUrl: string): string {
  try {
    const parsed = new URL(url)
    const baseParsed = new URL(baseUrl)

    // Remove base domain
    let path = parsed.pathname

    // Handle root path
    if (path === '/' || path === '') {
      return 'index.html'
    }

    // Remove leading slash
    path = path.replace(/^\//, '')

    // Add .html if no extension
    if (!path.match(/\.\w+$/)) {
      path = `${path}.html`
    }

    return path
  } catch (error) {
    return 'index.html'
  }
}

/**
 * Check if URL is valid HTTP/HTTPS
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch (error) {
    return false
  }
}

/**
 * Get file extension from URL
 */
export function getFileExtension(url: string): string | null {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    const match = pathname.match(/\.(\w+)$/)
    return match ? match[1] : null
  } catch (error) {
    return null
  }
}

/**
 * Determine asset type from URL
 */
export function getAssetType(url: string): 'css' | 'js' | 'image' | 'font' | 'other' {
  const ext = getFileExtension(url)?.toLowerCase()

  if (!ext) return 'other'

  if (['css'].includes(ext)) return 'css'
  if (['js', 'mjs'].includes(ext)) return 'js'
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif'].includes(ext)) return 'image'
  if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) return 'font'

  return 'other'
}
