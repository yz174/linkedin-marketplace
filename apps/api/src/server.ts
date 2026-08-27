import { buildApp } from './app';
import { env } from './env';
import { InProcessBroker } from './messaging/broker';
import { startExpirySweep } from './events/expiry';
import type { StatusBus } from './events/bus';

const bus: StatusBus = new InProcessBroker();
const app = buildApp(new InProcessBroker(), bus);
const { PORT, HOST } = env();

const stopSweep = startExpirySweep(bus);
app.addHook('onClose', async () => stopSweep());

await app.listen({ port: PORT, host: HOST });
console.log(`api listening on http://localhost:${PORT}`);
