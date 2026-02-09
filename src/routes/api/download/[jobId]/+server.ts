import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEnv } from '$lib/server/env';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ params, platform }) => {
	const env = getEnv(platform);

	const { jobId } = params;

	if (!jobId || !UUID_REGEX.test(jobId)) {
		throw error(400, 'Invalid job ID');
	}

	// Verify job is done
	const raw = await env.KV.get(`job:${jobId}`);
	if (!raw) {
		throw error(404, 'Job not found');
	}

	const job = JSON.parse(raw);
	if (job.status !== 'completed') {
		throw error(400, 'Job is not ready for download');
	}

	// Get ZIP from R2
	const r2Key = `archives/${jobId}.zip`;
	const object = await env.R2.get(r2Key);

	if (!object) {
		throw error(404, 'Archive not found. It may have expired.');
	}

	// Build filename from crawled domain
	let filename = `website-${jobId.slice(0, 8)}.zip`;
	try {
		const domain = new URL(job.url).hostname.replace(/^www\./, '');
		filename = `${domain}.zip`;
	} catch { /* fallback to default */ }

	const headers = new Headers();
	headers.set('Content-Type', 'application/zip');
	headers.set('Content-Disposition', `attachment; filename="${filename}"`);
	headers.set('Cache-Control', 'private, max-age=3600');

	if (object.size) {
		headers.set('Content-Length', String(object.size));
	}

	return new Response(object.body as ReadableStream, { headers });
};
