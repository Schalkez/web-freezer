/// <reference types="@sveltejs/adapter-cloudflare" />

import type { KVNamespace, R2Bucket, Queue, Fetcher } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Platform {
			env: {
				KV: KVNamespace;
				R2: R2Bucket;
				CRAWL_QUEUE: Queue;
				ASSETS: Fetcher;
				TURNSTILE_SITE_KEY: string;
				TURNSTILE_SECRET_KEY: string;
			};
		}
	}
}

export {};