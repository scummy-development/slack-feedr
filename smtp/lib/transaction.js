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
  }

  /**
   * @param {string} rcpt
   */
  addRecipient(rcpt) {
    this.to.push(rcpt);
  }

  /**
   * @param {string} data
   */
  addData(data) {
    this.data = data;
  }

  toString() {
    return JSON.stringify({
      id: this.id,
      from: this.from,
      to: this.to,
      data: this.data,
    });
  }
}
