/**
 * Asset Downloader
 * Downloads all discovered assets (CSS, JS, images, fonts)
 */

import { getAssetType } from './url-utils'

export interface DownloadedAsset {
  url: string
  content: ArrayBuffer
  type: 'css' | 'js' | 'image' | 'font' | 'other'
  localPath: string
}

export interface DownloadProgress {
  total: number
  downloaded: number
  failed: number
}

/**
 * Download multiple assets in parallel
 */
export async function downloadAssets(
  urls: string[],
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadedAsset[]> {
  const results: DownloadedAsset[] = []
  const progress: DownloadProgress = {
    total: urls.length,
    downloaded: 0,
    failed: 0,
  }

  // Download in batches of 10 to avoid overwhelming the server
  const batchSize = 10
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    const promises = batch.map((url) => downloadAsset(url))

    const batchResults = await Promise.allSettled(promises)

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
        progress.downloaded++
      } else {
        progress.failed++
      }

      if (onProgress) {
        onProgress({ ...progress })
      }
    }
  }

  return results
}

/**
 * Download a single asset
 */
async function downloadAsset(url: string): Promise<DownloadedAsset | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WebFreezer/1.0 (Website Archiver)',
      },
    })

    if (!response.ok) {
      return null
    }

    const content = await response.arrayBuffer()
    const type = getAssetType(url)
    const localPath = generateLocalPath(url, type)

    return {
      url,
      content,
      type,
      localPath,
    }
  } catch (error) {
    return null
  }
}

/**
 * Generate local file path for asset
 */
function generateLocalPath(
  url: string,
  type: 'css' | 'js' | 'image' | 'font' | 'other'
): string {
  const parsed = new URL(url)
  const pathname = parsed.pathname

  // Extract filename
  const filename = pathname.split('/').pop() || 'asset'

  // Generate hash from URL for uniqueness
  const hash = simpleHash(url).toString(36).substring(0, 8)

  // Determine directory based on type
  const dir = type === 'other' ? 'assets' : `assets/${type}`

  return `${dir}/${hash}-${filename}`
}

/**
 * Simple hash function for generating unique filenames
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Extract fonts from CSS content
 */
export async function extractFontsFromCSS(
  cssContent: string,
  cssUrl: string
): Promise<string[]> {
  const fontUrls: string[] = []
  const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g

  let match
  while ((match = urlRegex.exec(cssContent)) !== null) {
    const url = match[1]

    // Check if it's a font file
    if (url.match(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i)) {
      try {
        const absoluteUrl = new URL(url, cssUrl).href
        fontUrls.push(absoluteUrl)
      } catch (error) {
        // Skip invalid URLs
      }
    }
  }

  return Array.from(new Set(fontUrls))
}
