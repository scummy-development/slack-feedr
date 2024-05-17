import { SmtpGateway } from '../lib/smtp-gateway.js';

const serverName = process.argv[2] || 'localhost';

const gateway = new SmtpGateway(serverName);

gateway.on(
  'data',
  /** @param {import('../lib/transaction').SmtpTransaction} transaction  */
  (transaction) => {
    console.log('Transaction saved: %o', transaction);
  },
);

await gateway.listen(2525);
