import Elysia, { t } from 'elysia';
import { Redis } from '@upstash/redis/cloudflare';
import { fetchWeatherData } from './services/openmeteo';
import { SkyframeWeatherService, WeatherService } from './services/weather';


interface Env {
	SKYFLAME_KV: KVNamespace;
	UPSTASH_REDIS_REST_TOKEN: string;
	UPSTASH_REDIS_REST_URL: string;
}

let envLoaded = false;

const app = new Elysia({ aot: false })
	.decorate('env', {} as Env)
	.decorate('weatherService', new WeatherService(fetchWeatherData))
	.decorate('skyframeWeatherService', new SkyframeWeatherService(fetchWeatherData))
	.onError(({ code, error, set, body }) => {
		if (code === 'VALIDATION') {
			set.status = 400;
			return "Invalid request format.";
		}

		if (!['VALIDATION', 'NOT_FOUND'].includes(code as string)) {
			// 想定されないエラーは全部500
			console.error(`ERROR OCCURRED: ${error}`);
			console.error('===== STACK =====');
			// @ts-ignore
			console.error(error.stack);
			console.error('=================');
			set.status = 500;
			return 'An unexpected error occurred. The request was aborted.';
		}
	})

	.get(
		'/v1/overview',
		async (ctx) => {
			const lat = ctx.query.lat || ctx.request.cf?.latitude;
			const lon = ctx.query.lon || ctx.request.cf?.longitude;

			if (!lat || !lon) {
				return ctx.status(400, 'Latitude and longitude are required.');
			}

			const redis = ctx.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv(ctx.env) : null;
			const cacheKey = ctx.query.withDailySummary ? `weather:overviewWithDailySummary:${lat}:${lon}` : `weather:overview:${lat}:${lon}`;
			const cachedData = await redis?.get(cacheKey);

			if (cachedData) {
				return cachedData;
			}

			const weatherData = ctx.query.withDailySummary 
				? ctx.skyframeWeatherService.getOverview(lat as number, lon as number) 
				: ctx.weatherService.getOverview(lat as number, lon as number);
			
			await redis?.set(cacheKey, await weatherData, {
				// 30 minutes cache duration
				ex: 1800,
			});

			return weatherData;
		},
		{
			query: t.Object({
				lat: t.Optional(t.String()),
				lon: t.Optional(t.Number()),
				withDailySummary: t.Optional(t.Boolean()),
			}),
		}
	)

	.get('/redis', async (ctx) => {
		const redis = Redis.fromEnv(ctx.env);
		redis.set('test', 'Hello, World!');
		const test = await redis.get('test');

		return test;
	})
	.get('/healthz', async (ctx) => {
		ctx.env.SKYFLAME_KV.put('test', 'Hello, World!');

		const test = await ctx.env.SKYFLAME_KV.get('test');

		return test;
	});

app.compile();

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (!envLoaded) {
			app.decorate('env', env);
			envLoaded = true;
		}

		return app.fetch(request);
	},
} satisfies ExportedHandler<Env>;
