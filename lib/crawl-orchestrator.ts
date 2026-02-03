/**
 * Crawl Orchestrator
 * Main orchestration logic for website crawling
 */

import { parseSitemap } from './sitemap-parser'
import { crawlLinks, type CrawlOptions } from './link-crawler'
import { downloadPage } from './page-downloader'
import { downloadAssets, extractFontsFromCSS, type DownloadProgress } from './asset-downloader'
import { rewriteHTMLUrls, rewriteCSSUrls, buildURLMapping } from './url-rewriter'
import { buildPackage, calculateTotalSize, generateManifest, type PackageContent } from './package-builder'
import { extractDomain } from './url-utils'

export interface CrawlConfig {
  url: string
  method: 'sitemap' | 'link_discovery'
  maxPages?: number
  maxDepth?: number
}

export interface CrawlProgress {
  stage: 'discovering' | 'downloading_pages' | 'downloading_assets' | 'packaging'
  pagesDiscovered: number
  pagesDownloaded: number
  assetsDownloaded: number
  totalAssets: number
  percentage: number
}

export type ProgressCallback = (progress: CrawlProgress) => void

/**
 * Orchestrate full website crawl
 */
export async function crawlWebsite(
  config: CrawlConfig,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const domain = extractDomain(config.url)
  
  // Stage 1: Discover URLs
  onProgress?.({
    stage: 'discovering',
    pagesDiscovered: 0,
    pagesDownloaded: 0,
    assetsDownloaded: 0,
    totalAssets: 0,
    percentage: 0,
  })

  let urls: string[] = []
  let crawlMethod: 'sitemap' | 'link_discovery' = config.method

  if (config.method === 'sitemap') {
    const result = await parseSitemap(config.url)
    if (result.urls.length > 0) {
      urls = result.urls.slice(0, config.maxPages || 100)
    } else {
      // Fallback to link discovery
      crawlMethod = 'link_discovery'
    }
  }

  if (config.method === 'link_discovery' || urls.length === 0) {
    const crawlOptions: CrawlOptions = {
      maxDepth: config.maxDepth || 3,
      maxPages: config.maxPages || 100,
      sameDomainOnly: true,
    }
    const result = await crawlLinks(config.url, crawlOptions)
    urls = result.urls
  }

  onProgress?.({
    stage: 'discovering',
    pagesDiscovered: urls.length,
    pagesDownloaded: 0,
    assetsDownloaded: 0,
    totalAssets: 0,
    percentage: 10,
  })

  // Stage 2: Download pages
  const pages: Array<{ url: string; html: string; originalHtml: string }> = []
  const allAssetUrls = new Set<string>()

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    try {
      const pageResult = await downloadPage(url)
      pages.push({
        url,
        html: pageResult.html,
        originalHtml: pageResult.html,
      })

      // Collect all asset URLs
      Object.values(pageResult.assets).flat().forEach((assetUrl) => {
        allAssetUrls.add(assetUrl)
      })

      onProgress?.({
        stage: 'downloading_pages',
        pagesDiscovered: urls.length,
        pagesDownloaded: i + 1,
        assetsDownloaded: 0,
        totalAssets: allAssetUrls.size,
        percentage: 10 + (i / urls.length) * 30,
      })
    } catch (error) {
      // Skip failed pages
      continue
    }
  }

  // Stage 3: Download assets
  const assetUrls = Array.from(allAssetUrls)
  const downloadedAssets = await downloadAssets(assetUrls, (progress) => {
    onProgress?.({
      stage: 'downloading_assets',
      pagesDiscovered: urls.length,
      pagesDownloaded: pages.length,
      assetsDownloaded: progress.downloaded,
      totalAssets: progress.total,
      percentage: 40 + (progress.downloaded / progress.total) * 40,
    })
  })

  // Extract fonts from CSS
  const fontUrls = new Set<string>()
  for (const asset of downloadedAssets) {
    if (asset.type === 'css') {
      const cssContent = new TextDecoder().decode(asset.content)
      const fonts = await extractFontsFromCSS(cssContent, asset.url)
      fonts.forEach((font) => fontUrls.add(font))
    }
  }

  // Download fonts
  if (fontUrls.size > 0) {
    const fonts = await downloadAssets(Array.from(fontUrls))
    downloadedAssets.push(...fonts)
  }

  // Stage 4: Rewrite URLs
  const urlMapping = buildURLMapping(downloadedAssets)

  // Add page URL mappings
  for (const page of pages) {
    const localPath = urlToLocalPath(page.url, domain)
    urlMapping.set(page.url, localPath)
  }

  // Rewrite HTML
  for (const page of pages) {
    page.html = rewriteHTMLUrls(page.originalHtml, urlMapping)
  }

  // Rewrite CSS
  for (const asset of downloadedAssets) {
    if (asset.type === 'css') {
      const cssContent = new TextDecoder().decode(asset.content)
      const rewritten = rewriteCSSUrls(cssContent, urlMapping)
      asset.content = new TextEncoder().encode(rewritten).buffer
    }
  }

  // Stage 5: Package
  onProgress?.({
    stage: 'packaging',
    pagesDiscovered: urls.length,
    pagesDownloaded: pages.length,
    assetsDownloaded: downloadedAssets.length,
    totalAssets: downloadedAssets.length,
    percentage: 90,
  })

  const totalSizeMb = calculateTotalSize(pages, downloadedAssets)
  const manifest = generateManifest(
    domain,
    pages.length,
    downloadedAssets.length,
    totalSizeMb,
    crawlMethod
  )

  const packageContent: PackageContent = {
    pages,
    assets: downloadedAssets,
    manifest,
  }

  const zipBlob = await buildPackage(packageContent)

  onProgress?.({
    stage: 'packaging',
    pagesDiscovered: urls.length,
    pagesDownloaded: pages.length,
    assetsDownloaded: downloadedAssets.length,
    totalAssets: downloadedAssets.length,
    percentage: 100,
  })

  return zipBlob
}

/**
 * Convert URL to local file path
 */
function urlToLocalPath(url: string, domain: string): string {
  const parsed = new URL(url)
  let path = parsed.pathname

  if (path === '/' || path === '') {
    return 'index.html'
  }

  path = path.replace(/^\//, '')

  if (!path.match(/\.\w+$/)) {
    path = `${path}.html`
  }

  return path
}
