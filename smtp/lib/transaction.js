import { v4 } from 'uuid';

export class SmtpTransaction {
  id;
  from;

  /** @type {string[]} */
  to = [];

  /** @type {string|null} */
  data = null;

  /**
   * @param {string} from
   */
  constructor(from) {
    this.id = v4();
    this.from = from;

    console.log('Transaction %o created with FROM=%o', this.id, from);
  }

  /**
   * @param {string} rcpt
   */
  addRecipient(rcpt) {
    this.to.push(rcpt);

    console.log('Recipient %o added to transaction %o', rcpt, this.id);
  }

  /**
   * @param {string} data
   */
  setData(data) {
    this.data = data;

    console.log('Data %o set on transaction %o', data, this.id);
  }
}
