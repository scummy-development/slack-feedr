import { SmtpGateway } from './gateway.js';
import { store } from './store.js';

store.on('TRANSACTION_ADDED', (transactionId) => {
  const transaction = store.get(transactionId);
  console.log('Transaction saved: %o', transaction);
});

const gateway = new SmtpGateway();
await gateway.listen(2525);
