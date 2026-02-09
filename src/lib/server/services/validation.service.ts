import { validateUrl } from '$lib/server/url-validator';
import { verifyTurnstile } from '$lib/server/turnstile';
import { checkRateLimit, rateLimitHeaders } from '$lib/server/rate-limit';
import type { KVNamespace } from '@cloudflare/workers-types';

interface ValidationResult {
	valid: boolean;
	error?: string;
	status?: number;
	headers?: Record<string, string>;
	normalizedUrl?: string; // If valid
}

export class ValidationService {
	constructor(
		private kv: KVNamespace,
		private turnstileSecret: string
	) {}

	async validateCrawlRequest(
		url: string,
		turnstileToken: string,
		ip: string
	): Promise<ValidationResult> {
		// 1. Validate inputs
		if (!url || typeof url !== 'string') {
			return { valid: false, error: 'URL is required', status: 400 };
		}
		if (!turnstileToken || typeof turnstileToken !== 'string') {
			return { valid: false, error: 'Turnstile verification required', status: 400 };
		}

		// 2. Validate URL format & safety
		const urlResult = validateUrl(url);
		if (!urlResult.valid) {
			return { valid: false, error: urlResult.error, status: 400 };
		}

		// 3. Verify Turnstile
		const turnstileResult = await verifyTurnstile(turnstileToken, this.turnstileSecret, ip);
		if (!turnstileResult.success) {
			return { valid: false, error: turnstileResult.error, status: 403 };
		}

		// 4. Rate Limit
		const rateResult = await checkRateLimit(this.kv, ip);
		if (!rateResult.allowed) {
			return {
				valid: false,
				error: rateResult.error,
				status: 429,
				headers: rateLimitHeaders(rateResult),
			};
		}

		return {
			valid: true,
			normalizedUrl: urlResult.url!.href,
			headers: rateLimitHeaders(rateResult),
		};
	}
}
