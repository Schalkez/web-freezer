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

interface PageData {
  url: string
  html: string
  originalHtml: string
}

const DEFAULT_MAX_PAGES = 100
const DEFAULT_MAX_DEPTH = 3
const PROGRESS_WEIGHTS = {
  DISCOVERY: 10,
  PAGES: 30,
  ASSETS: 40,
  PACKAGING: 20,
} as const

export async function crawlWebsite(
  config: CrawlConfig,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const domain = extractDomain(config.url)
  
  const urls = await discoverUrls(config, onProgress)
  const pages = await downloadPages(urls, onProgress)
  const assets = await downloadAllAssets(pages, onProgress)
  const rewrittenContent = rewriteUrls(pages, assets, domain)
  
  return packageContent(rewrittenContent, domain, config.method, onProgress)
}

async function discoverUrls(
  config: CrawlConfig,
  onProgress?: ProgressCallback
): Promise<string[]> {
  reportProgress(onProgress, 'discovering', 0, 0, 0, 0, 0)

  let urls: string[] = []
  
  if (config.method === 'sitemap') {
    const result = await parseSitemap(config.url)
    if (result.urls.length > 0) {
      urls = result.urls.slice(0, config.maxPages || DEFAULT_MAX_PAGES)
    }
  }

  if (urls.length === 0) {
    const crawlOptions: CrawlOptions = {
      maxDepth: config.maxDepth || DEFAULT_MAX_DEPTH,
      maxPages: config.maxPages || DEFAULT_MAX_PAGES,
      sameDomainOnly: true,
    }
    const result = await crawlLinks(config.url, crawlOptions)
    urls = result.urls
  }

  reportProgress(onProgress, 'discovering', urls.length, 0, 0, 0, PROGRESS_WEIGHTS.DISCOVERY)
  return urls
}

async function downloadPages(
  urls: string[],
  onProgress?: ProgressCallback
): Promise<PageData[]> {
  const pages: PageData[] = []
  const allAssetUrls = new Set<string>()

  for (let i = 0; i < urls.length; i++) {
    try {
      const pageResult = await downloadPage(urls[i])
      pages.push({
        url: urls[i],
        html: pageResult.html,
        originalHtml: pageResult.html,
      })

      Object.values(pageResult.assets)
        .flat()
        .forEach((url) => allAssetUrls.add(url))

      const percentage = PROGRESS_WEIGHTS.DISCOVERY + 
        (i / urls.length) * PROGRESS_WEIGHTS.PAGES
      
      reportProgress(
        onProgress,
        'downloading_pages',
        urls.length,
        i + 1,
        0,
        allAssetUrls.size,
        percentage
      )
    } catch {
      continue
    }
  }

  return pages
}

async function downloadAllAssets(
  pages: PageData[],
  onProgress?: ProgressCallback
) {
  const allAssetUrls = new Set<string>()
  
  for (const page of pages) {
    const pageResult = await downloadPage(page.url)
    Object.values(pageResult.assets)
      .flat()
      .forEach((url) => allAssetUrls.add(url))
  }

  const assetUrls = Array.from(allAssetUrls)
  const downloadedAssets = await downloadAssets(assetUrls, (progress) => {
    const percentage = PROGRESS_WEIGHTS.DISCOVERY + 
      PROGRESS_WEIGHTS.PAGES + 
      (progress.downloaded / progress.total) * PROGRESS_WEIGHTS.ASSETS
    
    reportProgress(
      onProgress,
      'downloading_assets',
      pages.length,
      pages.length,
      progress.downloaded,
      progress.total,
      percentage
    )
  })

  const fonts = await extractAndDownloadFonts(downloadedAssets)
  return [...downloadedAssets, ...fonts]
}

async function extractAndDownloadFonts(assets: any[]) {
  const fontUrls = new Set<string>()
  
  for (const asset of assets) {
    if (asset.type === 'css') {
      const cssContent = new TextDecoder().decode(asset.content)
      const fonts = await extractFontsFromCSS(cssContent, asset.url)
      fonts.forEach((font) => fontUrls.add(font))
    }
  }

  if (fontUrls.size === 0) return []
  return downloadAssets(Array.from(fontUrls))
}

function rewriteUrls(pages: PageData[], assets: any[], domain: string) {
  const urlMapping = buildURLMapping(assets)

  for (const page of pages) {
    const localPath = urlToLocalPath(page.url, domain)
    urlMapping.set(page.url, localPath)
  }

  for (const page of pages) {
    page.html = rewriteHTMLUrls(page.originalHtml, urlMapping)
  }

  for (const asset of assets) {
    if (asset.type === 'css') {
      const cssContent = new TextDecoder().decode(asset.content)
      const rewritten = rewriteCSSUrls(cssContent, urlMapping)
      asset.content = new TextEncoder().encode(rewritten).buffer
    }
  }

  return { pages, assets }
}

async function packageContent(
  content: { pages: PageData[]; assets: any[] },
  domain: string,
  method: 'sitemap' | 'link_discovery',
  onProgress?: ProgressCallback
): Promise<Blob> {
  const { pages, assets } = content
  
  const percentage = PROGRESS_WEIGHTS.DISCOVERY + 
    PROGRESS_WEIGHTS.PAGES + 
    PROGRESS_WEIGHTS.ASSETS
  
  reportProgress(
    onProgress,
    'packaging',
    pages.length,
    pages.length,
    assets.length,
    assets.length,
    percentage
  )

  const totalSizeMb = calculateTotalSize(pages, assets)
  const manifest = generateManifest(
    domain,
    pages.length,
    assets.length,
    totalSizeMb,
    method
  )

  const packageContent: PackageContent = {
    pages,
    assets,
    manifest,
  }

  const zipBlob = await buildPackage(packageContent)

  reportProgress(
    onProgress,
    'packaging',
    pages.length,
    pages.length,
    assets.length,
    assets.length,
    100
  )

  return zipBlob
}

function reportProgress(
  callback: ProgressCallback | undefined,
  stage: CrawlProgress['stage'],
  pagesDiscovered: number,
  pagesDownloaded: number,
  assetsDownloaded: number,
  totalAssets: number,
  percentage: number
) {
  callback?.({
    stage,
    pagesDiscovered,
    pagesDownloaded,
    assetsDownloaded,
    totalAssets,
    percentage,
  })
}

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
