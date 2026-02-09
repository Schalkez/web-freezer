import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEnv } from '$lib/server/env';
import { JobService } from '$lib/server/services/job.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ params, platform }) => {
	const env = getEnv(platform);
	const jobService = new JobService(env.KV);
	const { jobId } = params;

	// Validate jobId format (prevent path traversal)
	if (!jobId || !UUID_REGEX.test(jobId)) {
		return json({ error: 'Invalid job ID' }, { status: 400 });
	}

	const job = await jobService.getJob(jobId);
	if (!job) {
		return json({ error: 'Job not found' }, { status: 404 });
	}

	return json({
		status: job.status,
		progress: job.progress ?? 0,
		pagesCrawled: job.pagesCrawled ?? 0,
		totalPages: job.totalPages ?? 0,
		error: job.error ?? null,
	});
};
