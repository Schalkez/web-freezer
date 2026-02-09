export interface CrawlMessage {
	jobId: string;
	url: string;
	ip: string;
}

export interface JobStatus {
	status: 'pending' | 'crawling' | 'completed' | 'failed';
	url: string;
	progress: number;
	pagesCrawled: number;
	totalPages: number;
	createdAt: number;
	ip: string;
	error?: string;
}

export interface CrawledFile {
	path: string;
	content: Uint8Array;
	contentType: string;
}

export interface Env {
	KV: KVNamespace;
	R2: R2Bucket;
}
