import { JOB_STATUS, type JobState, type LogEntry, type LogType } from '$lib/types';
import { submitCrawlJob, fetchJobStatus } from '$lib/client/crawl-api';
import { saveSession, loadSession, clearSession } from '$lib/client/session';

function timestamp(): string {
	return new Date().toLocaleTimeString('en-US', {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

export function createCrawlStore() {
	let url = $state('');
	let turnstileToken = $state('');
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	let job = $state<JobState>({
		status: JOB_STATUS.IDLE,
		jobId: null,
		progress: 0,
		pagesCrawled: 0,
		totalPages: 0,
		downloadUrl: null,
		error: null
	});

	let logs = $state<LogEntry[]>([]);

	const canSubmit = $derived(
		url.trim() !== '' && isValidUrl() && turnstileToken !== '' && job.status === JOB_STATUS.IDLE
	);

	function isValidUrl(): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	function addLog(message: string, type: LogType = 'info') {
		logs = [...logs, { time: timestamp(), message, type }];
	}

	function bootSequence() {
		addLog('SYSTEM_BOOT_SEQUENCE_INITIATED...', 'info');
		setTimeout(() => addLog('LOADING_CORE_MODULES... [OK]', 'success'), 400);
		setTimeout(() => addLog('ESTABLISHING_SECURE_UPLINK... [OK]', 'success'), 800);
		setTimeout(() => addLog('READY_FOR_INPUT.', 'info'), 1200);
	}

	async function pollOnce(lastPages: { value: number }) {
		if (!job.jobId) return;

		try {
			const data = await fetchJobStatus(job.jobId);

			job.status = data.status;
			job.progress = data.progress;
			job.pagesCrawled = data.pagesCrawled;
			job.totalPages = data.totalPages;

			if (job.pagesCrawled > lastPages.value) {
				addLog(`Crawled ${job.pagesCrawled} pages...`, 'info');
				lastPages.value = job.pagesCrawled;
			}

			if (data.status === JOB_STATUS.COMPLETED) {
				job.progress = 100;
				job.downloadUrl = `/api/download/${job.jobId}`;
				addLog('ARCHIVE_COMPLETE. READY_FOR_EXTRACTION.', 'success');
				clearSession();
				stopPolling();
			} else if (data.status === JOB_STATUS.FAILED) {
				job.error = data.error || 'Crawl failed';
				addLog(`Crawl aborted: ${job.error}`, 'error');
				clearSession();
				stopPolling();
			}
		} catch {
			// Network hiccup — keep polling
		}
	}

	function startPolling() {
		stopPolling();
		const lastPages = { value: 0 };

		// Fetch immediately, don't wait for first interval
		pollOnce(lastPages);

		pollInterval = setInterval(() => pollOnce(lastPages), 2000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function submit() {
		if (!canSubmit) return;

		job.status = JOB_STATUS.SUBMITTING;
		job.error = null;
		addLog(`Initiating freeze sequence for target: ${url}`, 'info');

		try {
			const data = await submitCrawlJob(url, turnstileToken);

			job.jobId = data.jobId;
			job.status = JOB_STATUS.PENDING;
			addLog(`Job accepted. ID: ${job.jobId}`, 'success');
			addLog('Queued for deep freeze...', 'info');

			saveSession(data.jobId, url);
			startPolling();
		} catch (err: unknown) {
			job.status = JOB_STATUS.FAILED;
			job.error = err instanceof Error ? err.message : 'Unknown error';
			addLog(`Submission error: ${job.error}`, 'error');
		}
	}

	function reset() {
		clearSession();
		stopPolling();
		url = '';
		turnstileToken = '';
		job = {
			status: JOB_STATUS.IDLE,
			jobId: null,
			progress: 0,
			pagesCrawled: 0,
			totalPages: 0,
			downloadUrl: null,
			error: null
		};
		logs = [];
		bootSequence();
	}

	function init() {
		bootSequence();

		const saved = loadSession();
		if (saved) {
			url = saved.url;
			job.jobId = saved.jobId;
			job.status = JOB_STATUS.PENDING;
			addLog(`Resuming session for: ${saved.url}`, 'info');
			addLog(`Job ID: ${saved.jobId}`, 'info');
			startPolling();
		}
	}

	return {
		get url() { return url; },
		set url(v: string) { url = v; },
		get turnstileToken() { return turnstileToken; },
		set turnstileToken(v: string) { turnstileToken = v; },
		get job() { return job; },
		get logs() { return logs; },
		get canSubmit() { return canSubmit; },
		submit,
		reset,
		init
	};
}
