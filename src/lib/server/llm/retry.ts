export interface RetryOptions {
	maxAttempts: number;
	backoffMs: number[];
	shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export interface RetryResult<T> {
	result: T;
	attempt: number;
	delaysUsedMs: number[];
}

export class RetryExhaustedError extends Error {
	attempts: number;
	delaysUsedMs: number[];
	lastError: unknown;

	constructor(params: { attempts: number; delaysUsedMs: number[]; lastError: unknown }) {
		super('Retry attempts exhausted');
		this.name = 'RetryExhaustedError';
		this.attempts = params.attempts;
		this.delaysUsedMs = params.delaysUsedMs;
		this.lastError = params.lastError;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithRetry<T>(
	operation: () => Promise<T>,
	options: RetryOptions
): Promise<RetryResult<T>> {
	const maxAttempts = Math.max(1, options.maxAttempts);
	const delaysUsedMs: number[] = [];
	let lastError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const result = await operation();
			return { result, attempt, delaysUsedMs };
		} catch (error) {
			lastError = error;
			const canRetry =
				attempt < maxAttempts && (options.shouldRetry ? options.shouldRetry(error, attempt) : true);
			if (!canRetry) {
				throw error;
			}

			const delay = options.backoffMs[Math.min(attempt - 1, options.backoffMs.length - 1)] ?? 0;
			if (delay > 0) {
				delaysUsedMs.push(delay);
				await sleep(delay);
			}
		}
	}

	throw new RetryExhaustedError({
		attempts: maxAttempts,
		delaysUsedMs,
		lastError
	});
}
