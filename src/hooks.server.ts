import { json, type Handle } from '@sveltejs/kit';

const MAX_JSON_BODY_BYTES = 1_000_000;
const MAX_MULTIPART_BODY_BYTES = 25 * 1024 * 1024;

function getContentLength(request: Request): number {
	const raw = request.headers.get('content-length');
	if (!raw) return -1;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : -1;
}

function isJsonRequest(request: Request): boolean {
	const contentType = request.headers.get('content-type') ?? '';
	return contentType.toLowerCase().includes('application/json');
}

function isMultipartRequest(request: Request): boolean {
	const contentType = request.headers.get('content-type') ?? '';
	return contentType.toLowerCase().includes('multipart/form-data');
}

function apiValidationError(status: number, message: string, requestId?: string) {
	return json(
		{
			ok: false,
			error: {
				code: 'VALIDATION_ERROR',
				message,
				requestId
			}
		},
		{
			status,
			headers: requestId ? { 'x-request-id': requestId } : undefined
		}
	);
}

function applySecurityHeaders(response: Response): void {
	const csp = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"font-src 'self' data:",
		"connect-src 'self'",
		"frame-src 'self'",
		"frame-ancestors 'none'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ');
	response.headers.set('content-security-policy', csp);
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
}

export const handle: Handle = async ({ event, resolve }) => {
	const requestId = event.request.headers.get('x-request-id') ?? crypto.randomUUID();
	(event.locals as { requestId?: string }).requestId = requestId;
	const pathname = event.url.pathname;
	const method = event.request.method;
	const isApi = pathname.startsWith('/api/');

	if (isApi && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
		const contentLength = getContentLength(event.request);
		if (pathname === '/api/pdf/parse') {
			if (!isMultipartRequest(event.request)) {
				return apiValidationError(
					415,
					'Content-Type must be multipart/form-data for PDF upload',
					requestId
				);
			}
			if (contentLength > MAX_MULTIPART_BODY_BYTES) {
				return apiValidationError(
					413,
					`Payload too large. Max ${MAX_MULTIPART_BODY_BYTES} bytes`,
					requestId
				);
			}
		} else {
			if (!isJsonRequest(event.request)) {
				return apiValidationError(415, 'Content-Type must be application/json', requestId);
			}
			if (contentLength > MAX_JSON_BODY_BYTES) {
				return apiValidationError(
					413,
					`Payload too large. Max ${MAX_JSON_BODY_BYTES} bytes`,
					requestId
				);
			}
		}
	}

	const response = await resolve(event);
	response.headers.set('x-request-id', requestId);
	applySecurityHeaders(response);
	return response;
};
