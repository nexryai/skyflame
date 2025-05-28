import Elysia from 'elysia';


let envLoaded = false;
const app = new Elysia({ aot: false, precompile: true })
	.decorate('env', {} as Env)
 	.get('/healthz', async ({ env }) => {
		return 'I\'m OK!';
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
