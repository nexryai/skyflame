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
	.decorate('weatherService', new WeatherService(fetchWeatherData))
	.get('/v1/overview', async (ctx) => {
		return ctx.weatherService.getOverview(35.4658224, 139.6199079);
	})
	.get('/redis', async (ctx) => {
		const redis = Redis.fromEnv(ctx.env);
		redis.set('test', 'Hello, World!');
		const test = await redis.get('test');

		return test;
	})
 	.get('/healthz', async (ctx) => {
		ctx.env.SKYFLAME_KV.put('test', 'Hello, World!')

		const test = await ctx.env.SKYFLAME_KV.get('test')

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
