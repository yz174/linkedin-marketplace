import { buildApp } from './app';
import { env } from './env';
import { InProcessBroker } from './messaging/broker';
import { startSweeps } from './events/expiry';
import type { StatusBus } from './events/bus';

const bus: StatusBus = new InProcessBroker();
const app = buildApp(new InProcessBroker(), bus);
const { PORT, HOST } = env();

const stopSweep = startSweeps(bus);
app.addHook('onClose', async () => stopSweep());

await app.listen({ port: PORT, host: HOST });
console.log(`api listening on http://localhost:${PORT}`);
