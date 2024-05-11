import { SmtpGateway } from './gateway.js';

const server = new SmtpGateway();

await server.listen(2525);
