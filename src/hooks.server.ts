import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Security headers
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('X-DNS-Prefetch-Control', 'on');
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

	// CSP
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"frame-src https://challenges.cloudflare.com",
			"connect-src 'self' https://challenges.cloudflare.com",
			"img-src 'self' data: https://challenges.cloudflare.com",
			"base-uri 'self'",
			"form-action 'self'",
		].join('; ')
	);

	return response;
};
