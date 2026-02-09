import type { Env, CrawlMessage, JobStatus } from './types';
import { crawlWebsite } from './crawler';
import { createZip } from './zip';

export default {
	async queue(batch: MessageBatch<CrawlMessage>, env: Env): Promise<void> {
		for (const message of batch.messages) {
			const { jobId, url, ip } = message.body;

			try {
				// Mark as crawling
				await env.KV.put(
					`job:${jobId}`,
					JSON.stringify({
						status: 'crawling',
						url,
						progress: 0,
						pagesCrawled: 0,
						totalPages: 0,
						createdAt: Date.now(),
						ip,
					} satisfies JobStatus),
					{ expirationTtl: 86400 }
				);

				// Crawl website
				const files = await crawlWebsite(url, env, jobId);

				if (files.length === 0) {
					throw new Error('No pages could be crawled from this URL');
				}

				// Create ZIP
				const zipData = createZip(files);

				// Upload to R2
				const r2Key = `archives/${jobId}.zip`;
				await env.R2.put(r2Key, zipData, {
					httpMetadata: {
						contentType: 'application/zip',
					},
					customMetadata: {
						jobId,
						url,
						pageCount: String(files.length),
					},
				});

				// Mark as done
				await env.KV.put(
					`job:${jobId}`,
					JSON.stringify({
						status: 'completed',
						url,
						progress: 100,
						pagesCrawled: files.length,
						totalPages: files.length,
						createdAt: Date.now(),
						ip,
					} satisfies JobStatus),
					{ expirationTtl: 86400 }
				);

				// Release rate limit slot
				await releaseJobSlot(env.KV, ip);

				message.ack();
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : 'Unknown error';
				console.error(`Crawl failed for job ${jobId}:`, errorMsg);

				await env.KV.put(
					`job:${jobId}`,
					JSON.stringify({
						status: 'failed',
						url,
						progress: 0,
						pagesCrawled: 0,
						totalPages: 0,
						createdAt: Date.now(),
						ip,
						error: errorMsg,
					} satisfies JobStatus),
					{ expirationTtl: 86400 }
				);

				// Release rate limit slot on error too
				await releaseJobSlot(env.KV, ip);

				// Retry if possible
				if (message.attempts < 2) {
					message.retry();
				} else {
					message.ack(); // Give up after retries
				}
			}
		}
	},
};

async function releaseJobSlot(kv: KVNamespace, ip: string): Promise<void> {
	const key = `ratelimit:${ip}`;
	const raw = await kv.get(key);
	if (!raw) return;

	try {
		const state = JSON.parse(raw);
		state.activeJobs = Math.max(0, (state.activeJobs || 0) - 1);
		await kv.put(key, JSON.stringify(state), { expirationTtl: 3600 });
	} catch {
		// Non-critical, ignore
	}
}
