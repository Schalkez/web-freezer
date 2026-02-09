export const JOB_STATUS = {
	IDLE: 'idle',
	SUBMITTING: 'submitting',
	PENDING: 'pending',
	CRAWLING: 'crawling',
	COMPLETED: 'completed',
	FAILED: 'failed'
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export interface JobState {
	status: JobStatus;
	jobId: string | null;
	progress: number;
	pagesCrawled: number;
	totalPages: number;
	downloadUrl: string | null;
	error: string | null;
}

export type LogType = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
	time: string;
	message: string;
	type: LogType;
}
