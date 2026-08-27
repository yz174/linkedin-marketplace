import { buildApp } from './app';
import { env } from './env';

const app = buildApp();
const { PORT, HOST } = env();

await app.listen({ port: PORT, host: HOST });
console.log(`api listening on http://localhost:${PORT}`);
