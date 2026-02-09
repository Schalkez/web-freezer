import type { KVNamespace, R2Bucket, Queue, Fetcher } from '@cloudflare/workers-types';

export interface AppEnv {
	KV: KVNamespace;
	R2: R2Bucket;
	CRAWL_QUEUE: Queue;
	ASSETS: Fetcher;
	TURNSTILE_SITE_KEY: string;
	TURNSTILE_SECRET_KEY: string;
}

export function getEnv(platform: App.Platform | undefined): AppEnv {
	if (!platform?.env) {
		throw new Error('Platform environment not available');
	}
	return platform.env as unknown as AppEnv;
}
