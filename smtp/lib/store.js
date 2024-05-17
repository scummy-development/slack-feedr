/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from 'events';
import { SmtpTransaction } from './transaction.js';

export class TransactionStore extends EventEmitter {
  #transactions = new Map();

  /**
   * @param {string} transactionId
   */
  get(transactionId) {
    return this.#transactions.get(transactionId);
  }

  /**
   * @param {SmtpTransaction} transaction
   */
  add(transaction) {
    this.#transactions.set(transaction.id, transaction);
    this.emit('TRANSACTION_ADDED', transaction.id);
  }

  /**
   * @param {SmtpTransaction} transaction
   */
  remove(transaction) {
    this.#transactions.delete(transaction.id);
    this.emit('TRANSACTION_REMOVED', transaction);
  }
}

export const store = new TransactionStore();
