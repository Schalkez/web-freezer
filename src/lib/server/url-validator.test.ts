import { describe, it, expect } from 'vitest';
import { validateUrl, validateRedirect } from '$lib/server/url-validator';

describe('validateUrl', () => {
	// ── Valid URLs ──────────────────────────────────────────────
	it('accepts valid HTTPS URL', () => {
		const result = validateUrl('https://example.com');
		expect(result.valid).toBe(true);
		expect(result.url?.href).toBe('https://example.com/');
	});

	it('accepts valid HTTP URL', () => {
		const result = validateUrl('http://example.com/page');
		expect(result.valid).toBe(true);
	});

	it('accepts URL with path, query, and fragment', () => {
		const result = validateUrl('https://example.com/path?q=1#section');
		expect(result.valid).toBe(true);
		expect(result.url?.pathname).toBe('/path');
	});

	it('accepts URL with port', () => {
		const result = validateUrl('https://example.com:8080/test');
		expect(result.valid).toBe(true);
	});

	it('accepts URL with subdomain', () => {
		const result = validateUrl('https://blog.example.com');
		expect(result.valid).toBe(true);
	});

	// ── Empty/Invalid Input ────────────────────────────────────
	it('rejects empty string', () => {
		const result = validateUrl('');
		expect(result.valid).toBe(false);
		expect(result.error).toBe('URL is required');
	});

	it('rejects null-ish input', () => {
		const result = validateUrl(undefined as any);
		expect(result.valid).toBe(false);
	});

	it('rejects non-string input', () => {
		const result = validateUrl(123 as any);
		expect(result.valid).toBe(false);
	});

	it('rejects malformed URL', () => {
		const result = validateUrl('not-a-url');
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Invalid URL format');
	});

	// ── URL Length ──────────────────────────────────────────────
	it('rejects URL longer than 2048 chars', () => {
		const longUrl = 'https://example.com/' + 'a'.repeat(2100);
		const result = validateUrl(longUrl);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('too long');
	});

	it('accepts URL exactly at 2048 chars', () => {
		const url = 'https://example.com/' + 'a'.repeat(2028);
		expect(url.length).toBe(2048);
		const result = validateUrl(url);
		expect(result.valid).toBe(true);
	});

	// ── Protocol Checks ────────────────────────────────────────
	it('rejects FTP protocol', () => {
		const result = validateUrl('ftp://example.com');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('HTTP');
	});

	it('rejects javascript: protocol', () => {
		const result = validateUrl('javascript:alert(1)');
		expect(result.valid).toBe(false);
	});

	it('rejects data: protocol', () => {
		const result = validateUrl('data:text/html,<h1>hi</h1>');
		expect(result.valid).toBe(false);
	});

	it('rejects file: protocol', () => {
		const result = validateUrl('file:///etc/passwd');
		expect(result.valid).toBe(false);
	});

	// ── SSRF Protection: Private IPs ───────────────────────────
	it('blocks localhost', () => {
		const result = validateUrl('http://localhost');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('not allowed');
	});

	it('blocks 127.0.0.1 (loopback)', () => {
		const result = validateUrl('http://127.0.0.1');
		expect(result.valid).toBe(false);
	});

	it('blocks 10.x.x.x (RFC1918)', () => {
		const result = validateUrl('http://10.0.0.1');
		expect(result.valid).toBe(false);
	});

	it('blocks 172.16.x.x (RFC1918)', () => {
		const result = validateUrl('http://172.16.0.1');
		expect(result.valid).toBe(false);
	});

	it('blocks 192.168.x.x (RFC1918)', () => {
		const result = validateUrl('http://192.168.1.1');
		expect(result.valid).toBe(false);
	});

	it('blocks 169.254.x.x (link-local)', () => {
		const result = validateUrl('http://169.254.1.1');
		expect(result.valid).toBe(false);
	});

	it('blocks AWS metadata endpoint', () => {
		const result = validateUrl('http://169.254.169.254/latest/meta-data/');
		expect(result.valid).toBe(false);
	});

	it('blocks GCP metadata hostname', () => {
		const result = validateUrl('http://metadata.google.internal');
		expect(result.valid).toBe(false);
	});

	it('blocks 0.0.0.0', () => {
		const result = validateUrl('http://0.0.0.0');
		expect(result.valid).toBe(false);
	});

	// ── Credentials in URL ─────────────────────────────────────
	it('rejects URL with username', () => {
		const result = validateUrl('https://admin@example.com');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('credentials');
	});

	it('rejects URL with username and password', () => {
		const result = validateUrl('https://admin:password@example.com');
		expect(result.valid).toBe(false);
	});
});

describe('validateRedirect', () => {
	it('accepts same-origin redirect', () => {
		const result = validateRedirect('https://example.com/page2', 'https://example.com');
		expect(result.valid).toBe(true);
	});

	it('accepts cross-origin redirect to public IP', () => {
		const result = validateRedirect('https://cdn.example.com/asset', 'https://example.com');
		expect(result.valid).toBe(true);
	});

	it('blocks cross-origin redirect to private IP', () => {
		const result = validateRedirect('http://192.168.1.1/admin', 'https://example.com');
		expect(result.valid).toBe(false);
	});

	it('blocks redirect to localhost', () => {
		const result = validateRedirect('http://localhost:3000', 'https://example.com');
		expect(result.valid).toBe(false);
	});
});
