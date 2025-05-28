import Elysia from 'elysia';


interface Env {
	SKYFLAME_KV: KVNamespace;
}

let envLoaded = false;
const app = new Elysia({ aot: false, precompile: true })
	.decorate('env', {} as Env)
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
