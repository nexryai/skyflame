import Elysia from 'elysia';
import { Redis } from '@upstash/redis/cloudflare';


interface Env {
	SKYFLAME_KV: KVNamespace;
	UPSTASH_REDIS_REST_TOKEN: string;
	UPSTASH_REDIS_REST_URL: string;
}

let envLoaded = false;
const app = new Elysia({ aot: false, precompile: true })
	.decorate('env', {} as Env)
	.get('/redis', async ({ env }) => {
		const redis = Redis.fromEnv(env);
		redis.set('test', 'Hello, World!');
		const test = await redis.get('test');

		return test;
	})
 	.get('/healthz', async ({ env }) => {
		env.SKYFLAME_KV.put('test', 'Hello, World!')
		
		const test = await env.SKYFLAME_KV.get('test')

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
