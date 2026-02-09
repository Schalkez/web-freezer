interface KV {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const MAX_REQUESTS = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CONCURRENT_LIMIT = 1;

interface RateLimitState {
	timestamps: number[];
	activeJobs: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
	error?: string;
}

export async function checkRateLimit(kv: KV, ip: string): Promise<RateLimitResult> {

	const key = `ratelimit:${ip}`;
	const now = Date.now();
	const windowStart = now - WINDOW_MS;

	const raw = await kv.get(key);
	const state: RateLimitState = raw
		? JSON.parse(raw)
		: { timestamps: [], activeJobs: 0 };

	// Clean old timestamps
	state.timestamps = state.timestamps.filter((t) => t > windowStart);

	// Check concurrent limit
	if (state.activeJobs >= CONCURRENT_LIMIT) {
		return {
			allowed: false,
			remaining: 0,
			resetAt: Math.ceil((state.timestamps[0] ?? now) + WINDOW_MS),
			error: 'You already have an active crawl job. Please wait for it to finish.',
		};
	}

	// Check rate limit
	if (state.timestamps.length >= MAX_REQUESTS) {
		const oldest = state.timestamps[0]!;
		return {
			allowed: false,
			remaining: 0,
			resetAt: Math.ceil(oldest + WINDOW_MS),
			error: `Rate limit exceeded. Max ${MAX_REQUESTS} requests per hour.`,
		};
	}

	return {
		allowed: true,
		remaining: MAX_REQUESTS - state.timestamps.length,
		resetAt: Math.ceil(now + WINDOW_MS),
	};
}

export async function recordRequest(kv: KV, ip: string): Promise<void> {
	const key = `ratelimit:${ip}`;
	const now = Date.now();
	const windowStart = now - WINDOW_MS;

	const raw = await kv.get(key);
	const state: RateLimitState = raw
		? JSON.parse(raw)
		: { timestamps: [], activeJobs: 0 };

	state.timestamps = state.timestamps.filter((t) => t > windowStart);
	state.timestamps.push(now);
	state.activeJobs += 1;

	await kv.put(key, JSON.stringify(state), { expirationTtl: 3600 });
}

export async function releaseJob(kv: KV, ip: string): Promise<void> {
	const key = `ratelimit:${ip}`;

	const raw = await kv.get(key);
	if (!raw) return;

	const state: RateLimitState = JSON.parse(raw);
	state.activeJobs = Math.max(0, state.activeJobs - 1);

	await kv.put(key, JSON.stringify(state), { expirationTtl: 3600 });
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
	return {
		'X-RateLimit-Limit': String(MAX_REQUESTS),
		'X-RateLimit-Remaining': String(result.remaining),
		'X-RateLimit-Reset': String(result.resetAt),
	};
}
