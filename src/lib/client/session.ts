const STORAGE_KEY = 'web-freezer-job';

export interface SavedSession {
	jobId: string;
	url: string;
}

export function saveSession(jobId: string, url: string): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobId, url }));
	} catch {
		/* quota exceeded or private browsing */
	}
}

export function loadSession(): SavedSession | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		if (data?.jobId && data?.url) return data as SavedSession;
	} catch {
		/* corrupted data */
	}
	return null;
}

export function clearSession(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		/* noop */
	}
}
