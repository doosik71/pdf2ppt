import {
	DEFAULT_PROVIDER,
	GEMINI_API_KEY,
	GEMINI_MODEL_ID,
	OLLAMA_BASE_URL,
	OLLAMA_MODEL_ID
} from '$env/static/private';
import { z } from 'zod';

const providerSchema = z.enum(['gemini', 'ollama']);

const rawEnvSchema = z.object({
	DEFAULT_PROVIDER: providerSchema.default('gemini'),
	GEMINI_API_KEY: z.string().trim().min(1).optional(),
	GEMINI_MODEL_ID: z.string().trim().min(1).optional(),
	OLLAMA_BASE_URL: z.url().optional(),
	OLLAMA_MODEL_ID: z.string().trim().min(1).optional()
});

const serverEnvSchema = rawEnvSchema.superRefine((value, ctx) => {
	if (value.DEFAULT_PROVIDER === 'gemini' && !value.GEMINI_API_KEY) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['GEMINI_API_KEY'],
			message: 'DEFAULT_PROVIDER=gemini requires GEMINI_API_KEY'
		});
	}

	if (value.DEFAULT_PROVIDER === 'ollama') {
		if (!value.OLLAMA_BASE_URL) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['OLLAMA_BASE_URL'],
				message: 'DEFAULT_PROVIDER=ollama requires OLLAMA_BASE_URL'
			});
		}
		if (!value.OLLAMA_MODEL_ID) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['OLLAMA_MODEL_ID'],
				message: 'DEFAULT_PROVIDER=ollama requires OLLAMA_MODEL_ID'
			});
		}
	}
});

export type ServerEnv = z.infer<typeof rawEnvSchema>;
export type LlmProvider = z.infer<typeof providerSchema>;

let cachedEnv: ServerEnv | null = null;

function formatError(error: z.ZodError): string {
	return error.issues
		.map((issue) => {
			const path = issue.path.length > 0 ? issue.path.join('.') : 'env';
			return `${path}: ${issue.message}`;
		})
		.join('; ');
}

export function loadServerEnv(): ServerEnv {
	const parsed = serverEnvSchema.safeParse({
		DEFAULT_PROVIDER,
		GEMINI_API_KEY: GEMINI_API_KEY || undefined,
		GEMINI_MODEL_ID: GEMINI_MODEL_ID || undefined,
		OLLAMA_BASE_URL: OLLAMA_BASE_URL || undefined,
		OLLAMA_MODEL_ID: OLLAMA_MODEL_ID || undefined
	});
	if (!parsed.success) {
		throw new Error(`Invalid server environment variables: ${formatError(parsed.error)}`);
	}

	return parsed.data;
}

export function getServerEnv(): ServerEnv {
	if (!cachedEnv) {
		cachedEnv = loadServerEnv();
	}

	return cachedEnv;
}
