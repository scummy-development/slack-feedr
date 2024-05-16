export class SmtpTransaction {
  from;

  /**
   * @type {string[]}
   */
  to = [];

  /**
   * @param {string} from
   */
  constructor(from) {
    this.from = from;
  }

  /**
   * @param {string} rcpt
   */
  addRecipient(rcpt) {
    this.to.push(rcpt);
  }
}
