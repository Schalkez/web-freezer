const PRIVATE_IP_RANGES = [
	// Loopback
	/^127\./,
	/^::1$/,
	/^0\.0\.0\.0$/,
	// RFC1918
	/^10\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	// Link-local
	/^169\.254\./,
	/^fe80:/i,
	// Cloud metadata
	/^169\.254\.169\.254$/,
	/^metadata\.google\.internal$/,
	// IPv6 private
	/^fc00:/i,
	/^fd00:/i,
];

const BLOCKED_HOSTNAMES = [
	'localhost',
	'metadata.google.internal',
	'instance-data',
];

const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export interface UrlValidationResult {
	valid: boolean;
	error?: string;
	url?: URL;
}

export function validateUrl(rawUrl: string): UrlValidationResult {
	if (!rawUrl || typeof rawUrl !== 'string') {
		return { valid: false, error: 'URL is required' };
	}

	if (rawUrl.length > MAX_URL_LENGTH) {
		return { valid: false, error: 'URL is too long (max 2048 characters)' };
	}

	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return { valid: false, error: 'Invalid URL format' };
	}

	// Protocol check
	if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
		return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
	}

	// Hostname checks
	const hostname = parsed.hostname.toLowerCase();

	if (BLOCKED_HOSTNAMES.includes(hostname)) {
		return { valid: false, error: 'This hostname is not allowed' };
	}

	// IP address check
	if (isPrivateIp(hostname)) {
		return { valid: false, error: 'Private/internal IP addresses are not allowed' };
	}

	// No empty hostname
	if (!hostname || hostname === '') {
		return { valid: false, error: 'URL must include a hostname' };
	}

	// No auth in URL
	if (parsed.username || parsed.password) {
		return { valid: false, error: 'URLs with credentials are not allowed' };
	}

	return { valid: true, url: parsed };
}

function isPrivateIp(hostname: string): boolean {
	return PRIVATE_IP_RANGES.some((pattern) => pattern.test(hostname));
}

/** Validate a redirect target — same rules + must be same origin */
export function validateRedirect(redirectUrl: string, originalOrigin: string): UrlValidationResult {
	const result = validateUrl(redirectUrl);
	if (!result.valid) return result;

	// For cross-origin redirects, re-validate
	if (result.url && result.url.origin !== originalOrigin) {
		if (isPrivateIp(result.url.hostname)) {
			return { valid: false, error: 'Redirect to private IP blocked' };
		}
	}

	return result;
}
