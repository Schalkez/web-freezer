import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyTurnstile } from '$lib/server/turnstile';

describe('verifyTurnstile', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('rejects empty token', async () => {
		const result = await verifyTurnstile('', 'secret');
		expect(result.success).toBe(false);
		expect(result.error).toContain('Missing');
	});

	it('rejects undefined token', async () => {
		const result = await verifyTurnstile(undefined as any, 'secret');
		expect(result.success).toBe(false);
	});

	it('rejects missing secret key', async () => {
		const result = await verifyTurnstile('token', '');
		expect(result.success).toBe(false);
		expect(result.error).toContain('not configured');
	});

	it('returns success on valid verification', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			json: () => Promise.resolve({ success: true }),
		}));

		const result = await verifyTurnstile('valid-token', 'secret', '1.2.3.4');
		expect(result.success).toBe(true);
	});

	it('returns error on failed verification', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			json: () => Promise.resolve({
				success: false,
				'error-codes': ['invalid-input-response'],
			}),
		}));

		const result = await verifyTurnstile('bad-token', 'secret');
		expect(result.success).toBe(false);
		expect(result.error).toContain('invalid-input-response');
	});

	it('handles network failure gracefully', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

		const result = await verifyTurnstile('token', 'secret');
		expect(result.success).toBe(false);
		expect(result.error).toContain('request failed');
	});

	it('sends IP in request when provided', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			json: () => Promise.resolve({ success: true }),
		});
		vi.stubGlobal('fetch', mockFetch);

		await verifyTurnstile('token', 'secret', '1.2.3.4');

		const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
		expect(body.get('remoteip')).toBe('1.2.3.4');
	});

	it('does not send IP when not provided', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			json: () => Promise.resolve({ success: true }),
		});
		vi.stubGlobal('fetch', mockFetch);

		await verifyTurnstile('token', 'secret');

		const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
		expect(body.has('remoteip')).toBe(false);
	});
});
