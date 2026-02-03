# Web Freezer

A website crawler and offline archiver that downloads entire websites for offline browsing.

## Features

- ⚡ **Sitemap Crawling**: Fast crawling via sitemap.xml
- 🔍 **Link Discovery**: Recursive link crawling for complete coverage
- 📦 **Offline Archive**: Downloads all pages and assets as a ZIP file
- 💰 **100% Free**: Runs on Cloudflare Workers free tier

## How It Works

1. Enter a website URL
2. Choose crawl strategy (Sitemap or Link Discovery)
3. Configure options (max pages, max depth)
4. Download the ZIP archive
5. Extract and open `index.html` offline

## Tech Stack

- **Frontend**: Next.js 15 + React 19 + Tailwind CSS v4
- **Crawler**: Cheerio (HTML parsing) + xml2js (sitemap parsing)
- **Packaging**: JSZip
- **Deployment**: Cloudflare Pages

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare Pages
npm run pages:deploy
```

## Limitations

- JavaScript-rendered content not captured (no browser automation)
- Dynamic API calls will fail offline
- Authentication-protected pages not included
- Infinite scroll content may be incomplete

## License

MIT
