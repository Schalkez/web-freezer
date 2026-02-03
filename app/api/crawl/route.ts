import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { crawlWebsite, type CrawlConfig } from '@/lib/crawl-orchestrator'

// Validation schema
const CrawlRequestSchema = z.object({
  url: z.string().url(),
  method: z.enum(['sitemap', 'link_discovery']).default('sitemap'),
  maxPages: z.number().min(1).max(500).default(100),
  maxDepth: z.number().min(1).max(5).default(3),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = CrawlRequestSchema.parse(body)

    // Validate URL is HTTP/HTTPS
    const url = new URL(validated.url)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'Only HTTP/HTTPS URLs are supported' },
        { status: 400 }
      )
    }

    // Start crawl
    const config: CrawlConfig = {
      url: validated.url,
      method: validated.method,
      maxPages: validated.maxPages,
      maxDepth: validated.maxDepth,
    }

    const zipBlob = await crawlWebsite(config)

    // Return ZIP file
    return new NextResponse(zipBlob, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${url.hostname}-${Date.now()}.zip"`,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Crawl error:', error)
    return NextResponse.json(
      { error: 'Failed to crawl website' },
      { status: 500 }
    )
  }
}
