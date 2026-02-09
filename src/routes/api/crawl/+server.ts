import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEnv } from '$lib/server/env';
import { ValidationService } from '$lib/server/services/validation.service';
import { JobService } from '$lib/server/services/job.service';
import { recordRequest } from '$lib/server/rate-limit'; // Keep rate limit recording seperate or move to service? ValidationService checks it, but recording is side effect.

export const POST: RequestHandler = async ({ request, platform, getClientAddress }) => {
	const env = getEnv(platform);
	const validationService = new ValidationService(env.KV, env.TURNSTILE_SECRET_KEY);
	const jobService = new JobService(env.KV);

	// Validate Content-Type
	const contentType = request.headers.get('content-type') || '';
	if (!contentType.includes('application/json')) {
		return json({ error: 'Content-Type must be application/json' }, { status: 415 });
	}

	// Parse body
	let body: { url?: string; turnstileToken?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	// Input length guard
	if (typeof body.url === 'string' && body.url.length > 2048) {
		return json({ error: 'URL too long (max 2048 characters)' }, { status: 400 });
	}

	const { url, turnstileToken } = body;
	const ip = getClientAddress();

	// Validate Request
	// ValidationService handles URL, Turnstile, and Rate Limit Check
	const validation = await validationService.validateCrawlRequest(
		url || '',
		turnstileToken || '',
		ip
	);

	if (!validation.valid) {
		return json(
			{ error: validation.error },
			{ status: validation.status ?? 400, headers: validation.headers }
		);
	}

	// Proceed
	const normalizedUrl = validation.normalizedUrl!;
	const jobId = crypto.randomUUID();

	// Record Rate Limit (Side Effect)
	// Ideally ValidationService could handle this if "allowed", or separate method.
	// For now, keep it here or add confirmRequest() to ValidationService?
	// Let's keep it explicit.
	await recordRequest(env.KV, ip);

	// Create Job
	await jobService.createJob(jobId, normalizedUrl, ip);

	// Push to Queue
	// Ideally QueueService, but keeping it simple for now as per plan
	await env.CRAWL_QUEUE.send({
		jobId,
		url: normalizedUrl,
		ip,
	});

	return json(
		{ jobId },
		{ status: 202, headers: validation.headers }
	);
};
