import Elysia from "elysia";

const app = new Elysia({ aot: false, precompile: true });

app.get('/healthz', async () => {
	return "I'm OK!";
});

app.compile();

export default {
	async fetch(request, env, ctx): Promise<Response> {
		return app.fetch(request);
	},
} satisfies ExportedHandler<Env>;
