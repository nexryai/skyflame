import Elysia from 'elysia';
import { Redis } from '@upstash/redis/cloudflare';
import { fetchWeatherData } from './services/openmeteo';
import { WeatherService } from './services/weather';


interface Env {
	SKYFLAME_KV: KVNamespace;
	UPSTASH_REDIS_REST_TOKEN: string;
	UPSTASH_REDIS_REST_URL: string;
}

let envLoaded = false;

const app = new Elysia({ aot: false, precompile: true })
	.decorate('env', {} as Env)
	.decorate('redis', null as Redis | null)
	.decorate('weatherService', new WeatherService(fetchWeatherData))
	.onError(({ code, error, set }) => {
		// 想定されないエラーは全部500
		if (!['VALIDATION', 'NOT_FOUND'].includes(code as string)) {
			console.error(`ERROR OCCURRED: ${error}`);
			console.error('===== STACK =====');
			// @ts-ignore
			console.error(error.stack);
			console.error('=================');
			set.status = 500;
			return 'An unexpected error occurred. The request was aborted.';
		}
	})

	.get('/v1/overview', async (ctx) => {
		const lat = ctx.query.lat || ctx.request.cf?.latitude;
		const lon = ctx.query.lon || ctx.request.cf?.longitude;

		if (!lat || !lon) {
			return ctx.status(400, 'Latitude and longitude are required.');
		}

		const cacheKey = `weather:overview:${lat}:${lon}`;
		const cachedData = await ctx.redis?.get(cacheKey);

		if (cachedData) {
			return cachedData;
		}

		if (!ctx.redis) {
			console.warn('Redis is not configured. Skipping cache.');
		}

		const weatherData = await ctx.weatherService.getOverview(lat as number, lon as number);
		await ctx.redis?.set(cacheKey, weatherData);

		return weatherData;
	})
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
			app.decorate('redis', env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv(env) : null);
			envLoaded = true;
		}

		return app.fetch(request);
	},
} satisfies ExportedHandler<Env>;
