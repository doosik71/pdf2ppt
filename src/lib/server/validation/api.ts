import { json, type RequestEvent } from '@sveltejs/kit';
import { ZodError } from 'zod';

const API_ERROR_CODES = [
	'VALIDATION_ERROR',
	'UNAUTHORIZED',
	'FORBIDDEN',
	'NOT_FOUND',
	'CONFLICT',
	'MODEL_ERROR',
	'TIMEOUT',
	'RATE_LIMIT',
	'INTERNAL_ERROR'
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
	ok: false;
	error: {
		code: ApiErrorCode;
		message: string;
		requestId?: string;
		details?: unknown;
	};
}

export interface ApiSuccessBody<T> {
	ok: true;
	data: T;
	requestId?: string;
}

type RateLimitEntry = {
	count: number;
	resetAt: number;
};

export interface ApiHandlerOptions {
	timeoutMs?: number;
	rateLimit?: {
		windowMs?: number;
		max?: number;
	};
}

const DEFAULT_TIMEOUT_MS = 450_000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 120;
const rateLimitStore = new Map<string, RateLimitEntry>();

export class ApiError extends Error {
	code: ApiErrorCode;
	status: number;
	details?: unknown;

	constructor(params: {
		code: ApiErrorCode;
		message: string;
		status: number;
		details?: unknown;
	}) {
		super(params.message);
		this.name = 'ApiError';
		this.code = params.code;
		this.status = params.status;
		this.details = params.details;
	}
}

export function apiError(params: {
	code: ApiErrorCode;
	message: string;
	status: number;
	details?: unknown;
}): ApiError {
	return new ApiError(params);
}

export function getRequestId(event: RequestEvent): string {
	const localRequestId = (event.locals as { requestId?: string }).requestId;
	if (localRequestId) return localRequestId;
	return event.request.headers.get('x-request-id') ?? crypto.randomUUID();
}

export function toApiError(error: unknown): ApiError {
	if (error instanceof ApiError) return error;

	if (error instanceof ZodError) {
		return apiError({
			code: 'VALIDATION_ERROR',
			status: 400,
			message: 'Request validation failed',
			details: error.flatten()
		});
	}

	if (error instanceof Error && error.name === 'AbortError') {
		return apiError({
			code: 'TIMEOUT',
			status: 504,
			message: 'The request timed out'
		});
	}

	const message = error instanceof Error ? error.message : 'Unexpected server error';

	if (/rate.?limit|too many requests/i.test(message)) {
		return apiError({
			code: 'RATE_LIMIT',
			status: 429,
			message: 'Rate limit exceeded'
		});
	}

	if (/model|gemini|ollama/i.test(message)) {
		return apiError({
			code: 'MODEL_ERROR',
			status: 502,
			message: 'Model provider request failed',
			details: { reason: message }
		});
	}

	return apiError({
		code: 'INTERNAL_ERROR',
		status: 500,
		message: 'Internal server error'
	});
}

export function errorResponse(error: unknown, requestId?: string) {
	const normalized = toApiError(error);
	const body: ApiErrorBody = {
		ok: false,
		error: {
			code: normalized.code,
			message: normalized.message,
			requestId,
			details: normalized.details
		}
	};

	return json(body, {
		status: normalized.status,
		headers: requestId ? { 'x-request-id': requestId } : undefined
	});
}

export function successResponse<T>(data: T, requestId?: string) {
	const body: ApiSuccessBody<T> = { ok: true, data, requestId };
	return json(body, {
		status: 200,
		headers: requestId ? { 'x-request-id': requestId } : undefined
	});
}

function getClientIp(event: RequestEvent): string {
	try {
		return event.getClientAddress?.() ?? 'unknown';
	} catch {
		return 'unknown';
	}
}

function now(): number {
	return Date.now();
}

function getRateLimitPolicy(pathname: string, options?: ApiHandlerOptions) {
	if (options?.rateLimit) {
		return {
			windowMs: options.rateLimit.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
			max: options.rateLimit.max ?? DEFAULT_RATE_LIMIT_MAX
		};
	}

	if (pathname === '/api/slide/generate') {
		return { windowMs: 60_000, max: 20 };
	}
	if (pathname === '/api/toc' || pathname === '/api/summary') {
		return { windowMs: 60_000, max: 30 };
	}
	if (pathname === '/api/pdf/parse') {
		return { windowMs: 60_000, max: 20 };
	}
	return { windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS, max: DEFAULT_RATE_LIMIT_MAX };
}

function checkRateLimit(event: RequestEvent, options?: ApiHandlerOptions) {
	const pathname = event.url.pathname;
	const method = event.request.method;
	if (!pathname.startsWith('/api/')) return;
	if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

	const policy = getRateLimitPolicy(pathname, options);
	const key = `${getClientIp(event)}:${pathname}`;
	const timestamp = now();
	const previous = rateLimitStore.get(key);
	if (!previous || previous.resetAt <= timestamp) {
		rateLimitStore.set(key, { count: 1, resetAt: timestamp + policy.windowMs });
		return;
	}
	if (previous.count >= policy.max) {
		throw apiError({
			code: 'RATE_LIMIT',
			status: 429,
			message: 'Rate limit exceeded',
			details: {
				windowMs: policy.windowMs,
				max: policy.max
			}
		});
	}
	previous.count += 1;
	rateLimitStore.set(key, previous);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	if (timeoutMs <= 0) return promise;
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => {
			setTimeout(() => {
				reject(
					apiError({
						code: 'TIMEOUT',
						status: 504,
						message: `Request timed out after ${timeoutMs}ms`
					})
				);
			}, timeoutMs);
		})
	]);
}

function logStructured(level: 'info' | 'error', payload: Record<string, unknown>) {
	const message = JSON.stringify({
		ts: new Date().toISOString(),
		level,
		...payload
	});
	if (level === 'error') {
		console.error(message);
		return;
	}
	console.info(message);
}

export function withApiHandler<T>(
	handler: (event: RequestEvent, requestId: string) => Promise<T>,
	options?: ApiHandlerOptions
) {
	return async (event: RequestEvent) => {
		const requestId = getRequestId(event);
		const startedAt = now();
		const clientIp = getClientIp(event);
		const { pathname } = event.url;
		const method = event.request.method;
		const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

		try {
			checkRateLimit(event, options);
			logStructured('info', {
				event: 'api.request.start',
				requestId,
				method,
				pathname,
				clientIp
			});

			const data = await withTimeout(handler(event, requestId), timeoutMs);
			logStructured('info', {
				event: 'api.request.success',
				requestId,
				method,
				pathname,
				clientIp,
				status: 200,
				durationMs: now() - startedAt
			});
			return successResponse(data, requestId);
		} catch (error) {
			const normalized = toApiError(error);
			logStructured('error', {
				event: 'api.request.error',
				requestId,
				method,
				pathname,
				clientIp,
				status: normalized.status,
				code: normalized.code,
				message: normalized.message,
				details: normalized.details,
				durationMs: now() - startedAt
			});
			return errorResponse(error, requestId);
		}
	};
}
