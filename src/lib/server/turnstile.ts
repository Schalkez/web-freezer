const VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileResult {
	success: boolean;
	error?: string;
}

export async function verifyTurnstile(
	token: string,
	secretKey: string,
	ip?: string | null
): Promise<TurnstileResult> {
	if (!token || typeof token !== 'string') {
		return { success: false, error: 'Missing Turnstile token' };
	}

	if (!secretKey) {
		return { success: false, error: 'Turnstile secret key not configured' };
	}

	const body = new URLSearchParams({
		secret: secretKey,
		response: token,
	});

	if (ip) body.set('remoteip', ip);

	try {
		const res = await fetch(VERIFY_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body,
		});

		const data: { success: boolean; 'error-codes'?: string[] } = await res.json();

		if (!data.success) {
			const codes = data['error-codes']?.join(', ') || 'unknown';
			return { success: false, error: `Verification failed: ${codes}` };
		}

		return { success: true };
	} catch {
		return { success: false, error: 'Turnstile verification request failed' };
	}
}
