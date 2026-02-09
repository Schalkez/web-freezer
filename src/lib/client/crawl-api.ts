import type { JobStatus } from '$lib/types';

export interface CrawlSubmitResponse {
	jobId: string;
	error?: string;
}

export interface JobStatusResponse {
	status: JobStatus;
	progress: number;
	pagesCrawled: number;
	totalPages: number;
	error?: string;
}

export async function submitCrawlJob(
	url: string,
	turnstileToken: string
): Promise<CrawlSubmitResponse> {
	const res = await fetch('/api/crawl', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url, turnstileToken })
	});

	const data = (await res.json()) as CrawlSubmitResponse;

	if (!res.ok) {
		throw new Error(data.error || 'Submission failed');
	}

	return data;
}

export async function fetchJobStatus(jobId: string): Promise<JobStatusResponse> {
	const res = await fetch(`/api/status/${jobId}`);

	if (!res.ok) {
		throw new Error(`Status check failed: ${res.status}`);
	}

	return (await res.json()) as JobStatusResponse;
}
