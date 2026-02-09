import type { CrawledFile, Env, JobStatus } from './types';
import { textToBytes } from './zip';

// --- Limits ---
const MAX_PAGES = 500;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const FETCH_TIMEOUT = 10000; // 10s per request
const CONCURRENT_FETCHES = 6;
const STATUS_UPDATE_INTERVAL = 5;
const JOB_TTL = 86400;

const SKIP_EXTENSIONS = new Set([
	'.mp4', '.webm', '.avi', '.mov', '.mkv',
	'.mp3', '.wav', '.ogg', '.flac',
	'.zip', '.tar', '.gz', '.rar', '.7z',
	'.exe', '.dmg', '.deb', '.rpm',
	'.iso', '.bin',
]);

const ASSET_EXTENSIONS = new Set([
	'.css', '.js', '.mjs',
	'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico', '.bmp',
	'.woff', '.woff2', '.ttf', '.eot', '.otf',
	'.json', '.xml', '.txt', '.webmanifest',
	'.map',
]);

const PRIVATE_IP_PATTERNS = [
	/^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
	/^169\.254\./, /^0\.0\.0\.0$/, /^::1$/, /^fc00:/i, /^fd00:/i, /^fe80:/i,
];

const BLOCKED_HOSTNAMES = ['localhost', 'metadata.google.internal', 'instance-data'];

// --- URL Helpers ---

function isPrivateHost(hostname: string): boolean {
	if (BLOCKED_HOSTNAMES.includes(hostname.toLowerCase())) return true;
	return PRIVATE_IP_PATTERNS.some((p) => p.test(hostname));
}

function isAssetUrl(url: URL): boolean {
	const ext = getExtension(url.pathname);
	return ext !== '' && ASSET_EXTENSIONS.has(ext);
}

function isSkippedUrl(url: URL): boolean {
	const ext = getExtension(url.pathname);
	return ext !== '' && SKIP_EXTENSIONS.has(ext);
}

function getExtension(pathname: string): string {
	const lastDot = pathname.lastIndexOf('.');
	if (lastDot === -1) return '';
	const ext = pathname.slice(lastDot).toLowerCase().split('?')[0];
	return ext;
}

function urlToFilePath(url: URL): string {
	let path = url.pathname;
	if (path.endsWith('/')) path += 'index.html';
	if (!path.includes('.')) path += '/index.html';
	return path.replace(/^\//, '');
}

/** Convert external URL to local path: _external/fonts.googleapis.com/css2/... */
function externalUrlToFilePath(url: URL): string {
	let path = url.pathname;
	if (path.endsWith('/')) path += 'index.html';
	path = path.replace(/^\//, '');
	// Include query params as part of filename for uniqueness (e.g. Google Fonts)
	if (url.search) {
		const safeQuery = url.search.slice(1).replace(/[^a-zA-Z0-9_=-]/g, '_');
		const lastDot = path.lastIndexOf('.');
		if (lastDot > -1) {
			path = `${path.slice(0, lastDot)}_${safeQuery}${path.slice(lastDot)}`;
		} else {
			path = `${path}_${safeQuery}`;
		}
	}
	return `_external/${url.hostname}/${path}`;
}

/** Calculate the relative prefix from a file to the ZIP root */
function getRelativePrefix(filePath: string): string {
	const depth = filePath.split('/').length - 1;
	return depth > 0 ? '../'.repeat(depth) : './';
}

// --- Fetching ---

async function safeFetch(url: string): Promise<Response | null> {
	try {
		const parsed = new URL(url);
		if (isPrivateHost(parsed.hostname)) return null;

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

		const res = await fetch(url, {
			signal: controller.signal,
			redirect: 'manual',
			headers: {
				'User-Agent': 'WebFreezer/1.0 (Website Archiver)',
				Accept: 'text/html,application/xhtml+xml,text/css,*/*',
			},
		});

		clearTimeout(timeout);

		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get('location');
			if (!location) return null;
			const redirectUrl = new URL(location, url);
			if (isPrivateHost(redirectUrl.hostname)) return null;
			return safeFetch(redirectUrl.href);
		}

		return res;
	} catch {
		return null;
	}
}

// --- Extraction ---

/** Extract same-origin page links from HTML */
function extractPageLinks(html: string, baseUrl: string, baseOrigin: string): string[] {
	const links: string[] = [];
	const regex = /(?:href)=["']([^"'#]+)["']/gi;
	let match;

	while ((match = regex.exec(html)) !== null) {
		try {
			const linked = new URL(match[1], baseUrl);
			if (linked.origin !== baseOrigin) continue;
			if (linked.protocol !== 'http:' && linked.protocol !== 'https:') continue;
			if (isSkippedUrl(linked)) continue;
			if (isAssetUrl(linked)) continue; // Assets handled separately
			links.push(linked.href);
		} catch { /* skip */ }
	}
	return links;
}

/** Extract ALL asset URLs from HTML (same-origin + cross-origin) */
function extractAssetsFromHtml(html: string, baseUrl: string): string[] {
	const assets = new Set<string>();

	// href/src/action attributes
	const attrRegex = /(?:href|src|action|poster)=["']([^"'#]+?)["']/gi;
	let match;
	while ((match = attrRegex.exec(html)) !== null) {
		addAsset(match[1], baseUrl, assets);
	}

	// srcset attribute
	const srcsetRegex = /srcset=["']([^"']+)["']/gi;
	while ((match = srcsetRegex.exec(html)) !== null) {
		const entries = match[1].split(',');
		for (const entry of entries) {
			const url = entry.trim().split(/\s+/)[0];
			if (url) addAsset(url, baseUrl, assets);
		}
	}

	// content attribute (og:image, twitter:image, etc.)
	const metaRegex = /content=["'](https?:\/\/[^"']+)["']/gi;
	while ((match = metaRegex.exec(html)) !== null) {
		addAsset(match[1], baseUrl, assets);
	}

	// Inline style url()
	const inlineUrlRegex = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi;
	while ((match = inlineUrlRegex.exec(html)) !== null) {
		if (!match[1].startsWith('data:')) {
			addAsset(match[1], baseUrl, assets);
		}
	}

	return [...assets];
}

/** Extract asset URLs from CSS content */
function extractAssetsFromCss(css: string, cssUrl: string): string[] {
	const assets = new Set<string>();

	// url() references
	const urlRegex = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi;
	let match;
	while ((match = urlRegex.exec(css)) !== null) {
		if (!match[1].startsWith('data:')) {
			addAsset(match[1], cssUrl, assets);
		}
	}

	// @import
	const importRegex = /@import\s+['"]([^'"]+)['"]/gi;
	while ((match = importRegex.exec(css)) !== null) {
		addAsset(match[1], cssUrl, assets);
	}

	return [...assets];
}

function addAsset(rawUrl: string, baseUrl: string, assets: Set<string>) {
	try {
		const resolved = new URL(rawUrl, baseUrl);
		if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return;
		if (isPrivateHost(resolved.hostname)) return;
		if (isSkippedUrl(resolved)) return;
		assets.add(resolved.href);
	} catch { /* skip */ }
}

// --- URL Rewriting ---

/** Rewrite all URLs in HTML to local relative paths */
function rewriteHtml(
	html: string,
	baseOrigin: string,
	currentPagePath: string,
	assetMap: Map<string, string>
): string {
	const prefix = getRelativePrefix(currentPagePath);

	// Rewrite href/src/action/poster attributes
	let result = html.replace(
		/(href|src|action|poster)=["']([^"'#]*?)["']/gi,
		(original, attr, rawUrl) => {
			const localPath = resolveToLocal(rawUrl, baseOrigin, currentPagePath, prefix, assetMap);
			return localPath ? `${attr}="${localPath}"` : original;
		}
	);

	// Rewrite srcset
	result = result.replace(
		/srcset=["']([^"']+)["']/gi,
		(original, srcsetVal) => {
			const entries = srcsetVal.split(',').map((entry: string) => {
				const parts = entry.trim().split(/\s+/);
				const url = parts[0];
				const descriptor = parts.slice(1).join(' ');
				const localPath = resolveToLocal(url, baseOrigin, currentPagePath, prefix, assetMap);
				if (localPath) {
					return descriptor ? `${localPath} ${descriptor}` : localPath;
				}
				return entry.trim();
			});
			return `srcset="${entries.join(', ')}"`;
		}
	);

	// Rewrite inline style url()
	result = result.replace(
		/url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi,
		(original, rawUrl) => {
			if (rawUrl.startsWith('data:')) return original;
			const localPath = resolveToLocal(rawUrl, baseOrigin, currentPagePath, prefix, assetMap);
			return localPath ? `url('${localPath}')` : original;
		}
	);

	return result;
}

/** Rewrite URLs inside CSS files */
function rewriteCss(
	css: string,
	baseOrigin: string,
	currentCssPath: string,
	assetMap: Map<string, string>
): string {
	const prefix = getRelativePrefix(currentCssPath);

	// Rewrite url()
	let result = css.replace(
		/url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi,
		(original, rawUrl) => {
			if (rawUrl.startsWith('data:')) return original;
			const localPath = resolveToLocal(rawUrl, baseOrigin, currentCssPath, prefix, assetMap);
			return localPath ? `url('${localPath}')` : original;
		}
	);

	// Rewrite @import
	result = result.replace(
		/@import\s+['"]([^'"]+)['"]/gi,
		(original, rawUrl) => {
			const localPath = resolveToLocal(rawUrl, baseOrigin, currentCssPath, prefix, assetMap);
			return localPath ? `@import '${localPath}'` : original;
		}
	);

	return result;
}

/** Resolve a raw URL to a local relative path, or null if not in assetMap */
function resolveToLocal(
	rawUrl: string,
	baseOrigin: string,
	currentFilePath: string,
	prefix: string,
	assetMap: Map<string, string>
): string | null {
	try {
		// Build absolute URL from the raw reference
		const currentDir = currentFilePath.includes('/')
			? currentFilePath.slice(0, currentFilePath.lastIndexOf('/') + 1)
			: '';
		// Try resolving as absolute first
		let absoluteUrl: URL;
		if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('//')) {
			absoluteUrl = new URL(rawUrl, baseOrigin);
		} else if (rawUrl.startsWith('/')) {
			absoluteUrl = new URL(rawUrl, baseOrigin);
		} else {
			// Relative URL — resolve from current file's context
			absoluteUrl = new URL(rawUrl, `${baseOrigin}/${currentDir}`);
		}

		// Check if we have this in our asset map
		const localPath = assetMap.get(absoluteUrl.href);
		if (localPath) {
			return `${prefix}${localPath}`;
		}

		// Same-origin path rewriting (for pages)
		if (absoluteUrl.origin === baseOrigin) {
			let filePath = absoluteUrl.pathname;
			if (filePath.endsWith('/')) filePath += 'index.html';
			if (!filePath.includes('.')) filePath += '/index.html';
			filePath = filePath.replace(/^\//, '');
			return `${prefix}${filePath}`;
		}
	} catch { /* skip */ }
	return null;
}

// --- Progress ---

async function updateJobProgress(
	env: Env,
	jobId: string,
	startUrl: string,
	filesCount: number,
	queueLength: number
) {
	const estimatedTotal = Math.max(filesCount + queueLength, filesCount);
	const progress = Math.min(95, Math.round((filesCount / Math.max(estimatedTotal, 1)) * 100));

	await env.KV.put(
		`job:${jobId}`,
		JSON.stringify({
			status: 'crawling',
			url: startUrl,
			progress,
			pagesCrawled: filesCount,
			totalPages: estimatedTotal,
			createdAt: Date.now(),
		} satisfies Partial<JobStatus>),
		{ expirationTtl: JOB_TTL }
	);
}

// --- Main Crawler ---

export async function crawlWebsite(
	startUrl: string,
	env: Env,
	jobId: string
): Promise<CrawledFile[]> {
	const baseUrl = new URL(startUrl);
	const baseOrigin = baseUrl.origin;
	const visited = new Set<string>();
	const pageQueue: string[] = [startUrl];
	const assetQueue: string[] = [];
	const files: CrawledFile[] = [];
	const assetMap = new Map<string, string>(); // absolute URL → local file path
	let totalSize = 0;

	// --- Phase 1: Crawl HTML pages (same-origin) ---
	while (pageQueue.length > 0 && files.length < MAX_PAGES && totalSize < MAX_TOTAL_SIZE) {
		const batch = pageQueue.splice(0, CONCURRENT_FETCHES);

		await Promise.allSettled(
			batch.map(async (pageUrl) => {
				const normalized = new URL(pageUrl);
				normalized.hash = '';
				const key = normalized.href;

				if (visited.has(key)) return;
				visited.add(key);

				const res = await safeFetch(key);
				if (!res || !res.ok) return;

				const contentType = res.headers.get('content-type') || '';
				const buffer = await res.arrayBuffer();

				if (buffer.byteLength > MAX_FILE_SIZE) return;
				if (totalSize + buffer.byteLength > MAX_TOTAL_SIZE) return;

				totalSize += buffer.byteLength;
				const isHtml = contentType.includes('text/html');

				if (isHtml) {
					const filePath = urlToFilePath(normalized);
					const text = new TextDecoder().decode(buffer);

					// Extract same-origin page links
					const pageLinks = extractPageLinks(text, key, baseOrigin);
					for (const link of pageLinks) {
						try {
							const linked = new URL(link);
							linked.hash = '';
							if (!visited.has(linked.href)) {
								pageQueue.push(linked.href);
							}
						} catch { /* skip */ }
					}

					// Extract ALL assets (same-origin + cross-origin)
					const assets = extractAssetsFromHtml(text, key);
					for (const asset of assets) {
						if (!visited.has(asset)) {
							assetQueue.push(asset);
						}
					}

					// Store HTML (rewriting happens in Phase 3)
					files.push({
						path: filePath,
						content: textToBytes(text), // Raw for now — rewritten later
						contentType,
					});
				} else {
					// Same-origin non-HTML asset discovered via page navigation
					const filePath = urlToFilePath(normalized);
					assetMap.set(key, filePath);
					files.push({
						path: filePath,
						content: new Uint8Array(buffer),
						contentType,
					});
				}
			})
		);

		if (files.length % STATUS_UPDATE_INTERVAL === 0) {
			await updateJobProgress(env, jobId, startUrl, files.length, pageQueue.length + assetQueue.length);
		}
	}

	// --- Phase 2: Download assets (same-origin + cross-origin) ---
	const assetBatches = [];
	const uniqueAssets = [...new Set(assetQueue)].filter(url => !visited.has(url));

	for (let i = 0; i < uniqueAssets.length; i += CONCURRENT_FETCHES) {
		assetBatches.push(uniqueAssets.slice(i, i + CONCURRENT_FETCHES));
	}

	for (const batch of assetBatches) {
		if (totalSize >= MAX_TOTAL_SIZE || files.length >= MAX_PAGES * 3) break;

		await Promise.allSettled(
			batch.map(async (assetUrl) => {
				if (visited.has(assetUrl)) return;
				visited.add(assetUrl);

				const res = await safeFetch(assetUrl);
				if (!res || !res.ok) return;

				const buffer = await res.arrayBuffer();
				if (buffer.byteLength > MAX_FILE_SIZE) return;
				if (totalSize + buffer.byteLength > MAX_TOTAL_SIZE) return;

				totalSize += buffer.byteLength;

				const parsed = new URL(assetUrl);
				const contentType = res.headers.get('content-type') || '';

				// Determine local path
				const isSameOrigin = parsed.origin === baseOrigin;
				const filePath = isSameOrigin
					? urlToFilePath(parsed)
					: externalUrlToFilePath(parsed);

				assetMap.set(assetUrl, filePath);

				// If CSS, extract nested assets (fonts, images referenced in CSS)
				const isCss = contentType.includes('text/css') || getExtension(parsed.pathname) === '.css';
				if (isCss) {
					const cssText = new TextDecoder().decode(buffer);
					const nestedAssets = extractAssetsFromCss(cssText, assetUrl);
					for (const nested of nestedAssets) {
						if (!visited.has(nested)) {
							// Add to a secondary queue — will process inline
							visited.add(nested);
							const nestedRes = await safeFetch(nested);
							if (nestedRes && nestedRes.ok) {
								const nestedBuf = await nestedRes.arrayBuffer();
								if (nestedBuf.byteLength <= MAX_FILE_SIZE && totalSize + nestedBuf.byteLength <= MAX_TOTAL_SIZE) {
									totalSize += nestedBuf.byteLength;
									const nestedParsed = new URL(nested);
									const nestedPath = nestedParsed.origin === baseOrigin
										? urlToFilePath(nestedParsed)
										: externalUrlToFilePath(nestedParsed);
									assetMap.set(nested, nestedPath);
									files.push({
										path: nestedPath,
										content: new Uint8Array(nestedBuf),
										contentType: nestedRes.headers.get('content-type') || '',
									});
								}
							}
						}
					}

					// Store CSS (rewriting happens in Phase 3)
					files.push({
						path: filePath,
						content: textToBytes(cssText),
						contentType,
					});
				} else {
					files.push({
						path: filePath,
						content: new Uint8Array(buffer),
						contentType,
					});
				}
			})
		);

		await updateJobProgress(env, jobId, startUrl, files.length, uniqueAssets.length - files.length);
	}

	// --- Phase 3: Rewrite all HTML and CSS files ---
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const ct = file.contentType;

		if (ct.includes('text/html')) {
			const html = new TextDecoder().decode(file.content);
			const rewritten = rewriteHtml(html, baseOrigin, file.path, assetMap);
			files[i] = { ...file, content: textToBytes(rewritten) };
		} else if (ct.includes('text/css') || file.path.endsWith('.css')) {
			const css = new TextDecoder().decode(file.content);
			const rewritten = rewriteCss(css, baseOrigin, file.path, assetMap);
			files[i] = { ...file, content: textToBytes(rewritten) };
		}
	}

	return files;
}
