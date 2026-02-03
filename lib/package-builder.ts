/**
 * Package Builder
 * Assembles downloaded pages and assets into a ZIP archive
 */

import JSZip from 'jszip'
import { urlToFilePath } from './url-utils'

export interface PackageManifest {
  domain: string
  crawled_at: string
  pages: number
  assets: number
  total_size_mb: number
  crawl_method: 'sitemap' | 'link_discovery'
  limitations: string[]
}

export interface PackageContent {
  pages: Array<{ url: string; html: string }>
  assets: Array<{ localPath: string; content: ArrayBuffer }>
  manifest: PackageManifest
}

/**
 * Build ZIP archive from crawled content
 */
export async function buildPackage(
  content: PackageContent
): Promise<Blob> {
  const zip = new JSZip()

  // Add pages
  for (const page of content.pages) {
    const filePath = urlToFilePath(page.url, content.manifest.domain)
    zip.file(filePath, page.html)
  }

  // Add assets
  for (const asset of content.assets) {
    zip.file(asset.localPath, asset.content)
  }

  // Add manifest
  zip.file('manifest.json', JSON.stringify(content.manifest, null, 2))

  // Generate ZIP
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    },
  })

  return blob
}

/**
 * Calculate total size of content
 */
export function calculateTotalSize(
  pages: Array<{ html: string }>,
  assets: Array<{ content: ArrayBuffer }>
): number {
  let totalBytes = 0

  // Calculate page sizes
  for (const page of pages) {
    totalBytes += new Blob([page.html]).size
  }

  // Calculate asset sizes
  for (const asset of assets) {
    totalBytes += asset.content.byteLength
  }

  // Convert to MB
  return totalBytes / (1024 * 1024)
}

/**
 * Generate package manifest
 */
export function generateManifest(
  domain: string,
  pages: number,
  assets: number,
  totalSizeMb: number,
  crawlMethod: 'sitemap' | 'link_discovery'
): PackageManifest {
  return {
    domain,
    crawled_at: new Date().toISOString(),
    pages,
    assets,
    total_size_mb: Math.round(totalSizeMb * 100) / 100,
    crawl_method: crawlMethod,
    limitations: [
      'JavaScript-rendered content not captured',
      'Dynamic API calls will fail offline',
      'Authentication-protected pages not included',
      'Infinite scroll content may be incomplete',
    ],
  }
}
