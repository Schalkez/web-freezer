import type { KVNamespace } from '@cloudflare/workers-types';
import { JOB_STATUS, type JobStatus } from '$lib/types';

export interface JobData {
	status: Extract<JobStatus, 'pending' | 'crawling' | 'completed' | 'failed'>;
	url: string;
	progress: number;
	pagesCrawled: number;
	totalPages: number;
	createdAt: number;
	ip: string;
	error?: string;
}

export class JobService {
	constructor(private kv: KVNamespace) {}

	async createJob(jobId: string, url: string, ip: string): Promise<void> {
		const jobData: JobData = {
			status: JOB_STATUS.PENDING,
			url,
			progress: 0,
			pagesCrawled: 0,
			totalPages: 0,
			createdAt: Date.now(),
			ip,
		};
		await this.kv.put(`job:${jobId}`, JSON.stringify(jobData), { expirationTtl: 86400 });
	}

	async getJob(jobId: string): Promise<JobData | null> {
		const raw = await this.kv.get(`job:${jobId}`);
		if (!raw) return null;
		return JSON.parse(raw) as JobData;
	}

	async updateJob(jobId: string, data: Partial<JobData>): Promise<void> {
		const current = await this.getJob(jobId);
		if (!current) throw new Error('Job not found');
		
		const updated = { ...current, ...data };
		await this.kv.put(`job:${jobId}`, JSON.stringify(updated), { expirationTtl: 86400 });
	}
}
