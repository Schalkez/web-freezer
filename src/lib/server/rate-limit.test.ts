import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	checkRateLimit,
	recordRequest,
	releaseJob,
	rateLimitHeaders,
} from '$lib/server/rate-limit';

function createMockKV() {
	const store = new Map<string, string>();
	return {
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		put: vi.fn(async (key: string, value: string) => {
			store.set(key, value);
		}),
		_store: store,
	};
}

describe('checkRateLimit', () => {
	let kv: ReturnType<typeof createMockKV>;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('allows first request from new IP', async () => {
		const result = await checkRateLimit(kv, '1.2.3.4');
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(10);
	});

	it('allows request when under limit', async () => {
		// Simulate 5 previous requests
		const state = {
			timestamps: Array.from({ length: 5 }, () => Date.now()),
			activeJobs: 0,
		};
		kv._store.set('ratelimit:1.2.3.4', JSON.stringify(state));

		const result = await checkRateLimit(kv, '1.2.3.4');
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(5);
	});

	it('blocks when rate limit exceeded (10 requests)', async () => {
		const state = {
			timestamps: Array.from({ length: 10 }, () => Date.now()),
			activeJobs: 0,
		};
		kv._store.set('ratelimit:1.2.3.4', JSON.stringify(state));

		const result = await checkRateLimit(kv, '1.2.3.4');
		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
		expect(result.error).toContain('Rate limit');
	});

	it('blocks when concurrent job active', async () => {
		const state = {
			timestamps: [Date.now()],
			activeJobs: 1,
		};
		kv._store.set('ratelimit:1.2.3.4', JSON.stringify(state));

		const result = await checkRateLimit(kv, '1.2.3.4');
		expect(result.allowed).toBe(false);
		expect(result.error).toContain('active crawl job');
	});

	it('cleans expired timestamps beyond 1 hour window', async () => {
		const hourAgo = Date.now() - 61 * 60 * 1000; // 61 min ago
		const state = {
			timestamps: Array.from({ length: 10 }, () => hourAgo),
			activeJobs: 0,
		};
		kv._store.set('ratelimit:1.2.3.4', JSON.stringify(state));

		const result = await checkRateLimit(kv, '1.2.3.4');
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(10);
	});

	it('isolates rate limits by IP', async () => {
		const state = {
			timestamps: Array.from({ length: 10 }, () => Date.now()),
			activeJobs: 0,
		};
		kv._store.set('ratelimit:1.1.1.1', JSON.stringify(state));

		const result = await checkRateLimit(kv, '2.2.2.2');
		expect(result.allowed).toBe(true);
	});
});

describe('recordRequest', () => {
	let kv: ReturnType<typeof createMockKV>;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('records timestamp and increments active jobs', async () => {
		await recordRequest(kv, '1.2.3.4');

		expect(kv.put).toHaveBeenCalledOnce();
		const saved = JSON.parse(kv._store.get('ratelimit:1.2.3.4')!);
		expect(saved.timestamps).toHaveLength(1);
		expect(saved.activeJobs).toBe(1);
	});

	it('appends to existing records', async () => {
		const state = {
			timestamps: [Date.now()],
			activeJobs: 0,
		};
		kv._store.set('ratelimit:1.2.3.4', JSON.stringify(state));

		await recordRequest(kv, '1.2.3.4');

		const saved = JSON.parse(kv._store.get('ratelimit:1.2.3.4')!);
		expect(saved.timestamps).toHaveLength(2);
		expect(saved.activeJobs).toBe(1);
	});

	it('sets TTL on KV entry', async () => {
		await recordRequest(kv, '1.2.3.4');
		expect(kv.put).toHaveBeenCalledWith(
			'ratelimit:1.2.3.4',
			expect.any(String),
			{ expirationTtl: 3600 }
		);
	});
});

describe('releaseJob', () => {
	let kv: ReturnType<typeof createMockKV>;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('decrements active jobs', async () => {
		const state = { timestamps: [Date.now()], activeJobs: 1 };
		kv._store.set('ratelimit:1.2.3.4', JSON.stringify(state));

		await releaseJob(kv, '1.2.3.4');

		const saved = JSON.parse(kv._store.get('ratelimit:1.2.3.4')!);
		expect(saved.activeJobs).toBe(0);
	});

	it('does not go below 0', async () => {
		const state = { timestamps: [], activeJobs: 0 };
		kv._store.set('ratelimit:1.2.3.4', JSON.stringify(state));

		await releaseJob(kv, '1.2.3.4');

		const saved = JSON.parse(kv._store.get('ratelimit:1.2.3.4')!);
		expect(saved.activeJobs).toBe(0);
	});

	it('handles missing KV entry gracefully', async () => {
		await expect(releaseJob(kv, '1.2.3.4')).resolves.not.toThrow();
	});
});

describe('rateLimitHeaders', () => {
	it('returns correct header format', () => {
		const headers = rateLimitHeaders({
			allowed: true,
			remaining: 7,
			resetAt: 1700000000,
		});

		expect(headers['X-RateLimit-Limit']).toBe('10');
		expect(headers['X-RateLimit-Remaining']).toBe('7');
		expect(headers['X-RateLimit-Reset']).toBe('1700000000');
	});
});
