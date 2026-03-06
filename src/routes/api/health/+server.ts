import { withApiHandler } from '$lib/server/validation';
import { getServerEnv } from '$lib/server/env';

export const GET = withApiHandler(async () => {
	const env = getServerEnv();
	return {
		status: 'ok',
		service: 'ppt2slide',
		provider: env.DEFAULT_PROVIDER,
		timestamp: new Date().toISOString(),
		uptimeSeconds: Math.floor(process.uptime())
	};
});
