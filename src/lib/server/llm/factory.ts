import { getServerEnv, type LlmProvider as LlmProviderName } from '$lib/server/env';

import { GeminiAdapter, OllamaAdapter } from './adapters';
import type { LlmProvider } from './provider';

let cachedDefaultProvider: LlmProvider | null = null;

export function createLlmProvider(providerName: LlmProviderName): LlmProvider {
	switch (providerName) {
		case 'gemini':
			return new GeminiAdapter();
		case 'ollama':
			return new OllamaAdapter();
		default:
			throw new Error(`Unsupported provider: ${providerName}`);
	}
}

export function getDefaultLlmProvider(): LlmProvider {
	if (!cachedDefaultProvider) {
		const { DEFAULT_PROVIDER } = getServerEnv();
		cachedDefaultProvider = createLlmProvider(DEFAULT_PROVIDER);
	}

	return cachedDefaultProvider;
}
