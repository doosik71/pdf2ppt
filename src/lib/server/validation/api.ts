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

	return json(body, { status: normalized.status });
}

export function successResponse<T>(data: T, requestId?: string) {
	const body: ApiSuccessBody<T> = { ok: true, data, requestId };
	return json(body, { status: 200 });
}

export function withApiHandler<T>(
	handler: (event: RequestEvent, requestId: string) => Promise<T>
) {
	return async (event: RequestEvent) => {
		const requestId = getRequestId(event);
		try {
			const data = await handler(event, requestId);
			return successResponse(data, requestId);
		} catch (error) {
			return errorResponse(error, requestId);
		}
	};
}
