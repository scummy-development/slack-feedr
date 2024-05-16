export class SmtpTransaction {
  #from;

  /**
   * @type {string[]}
   */
  #to = [];

  #data;

  get from() {
    return this.#from;
  }

  get to() {
    return this.#to;
  }

  get data() {
    return this.#data;
  }

  /**
   * @param {string} from
   */
  constructor(from) {
    this.#from = from;
  }

  /**
   * @param {string} rcpt
   */
  addRecipient(rcpt) {
    this.#to.push(rcpt);
  }

  /**
   * @param {string} data
   */
  addData(data) {
    this.#data = data;
  }

  toString() {
    return JSON.stringify({
      from: this.#from,
      to: this.#to,
      data: this.#data,
    });
  }
}
