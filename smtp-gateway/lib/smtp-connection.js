/* eslint-disable @typescript-eslint/no-unused-vars */
import { Socket } from 'net';
import { v4 } from 'uuid';
import { CRLF } from './constants.js';
import { SmtpSession } from './smtp-session.js';

export class SmtpConnection {
  id;
  remoteAddress;

  #socket;
  #buffer = '';
  #gateway;
  #session;

  /**
   * @param {Socket} socket
   * @param {SmtpGateway} gateway
   */
  constructor(socket, gateway) {
    this.id = v4();
    this.remoteAddress = socket.address().address;

    this.#socket = socket;
    this.#gateway = gateway;
    this.#session = new SmtpSession(this, this.#gateway);

    this.#socket.on('data', this.#handleData.bind(this));
    this.#socket.on('end', this.#handleEnd.bind(this));
    this.#socket.on('error', (err) => {
      if (err.code === 'ECONNRESET') {
        console.log('Connection reset for session %o', this.#session.id);
      } else {
        console.error(err);
      }
    });

    this.#session.sendReady();
  }

  /**
   * @param {number|string} code
   * @param {...string} lines
   * @returns {Promise<void>}
   */
  write(code, ...lines) {
    const codedLines = lines.map(
      (line, i) => code + (i === lines.length - 1 ? ' ' : '-') + line,
    );

    if (codedLines.length === 0) {
      codedLines.push(code);
    }

    return new Promise((resolve, reject) => {
      this.#socket.write(codedLines.join(CRLF) + CRLF, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * @returns {Promise<void>}
   */
  end() {
    return new Promise((resolve) => {
      this.#socket.end(() => {
        resolve();
      });
    });
  }

  #clearBuffer() {
    this.#buffer = '';
  }

  /**
   * @param {Buffer} data
   */
  #handleData(data) {
    for (const charcode of data) {
      this.#buffer += String.fromCharCode(charcode);

      if (this.#buffer.endsWith(CRLF)) {
        this.emit('line', this.#buffer.slice(0, -CRLF.length));
        this.#clearBuffer();
      }
    }
  }

  #handleEnd() {
    console.log('Connection closed');
  }
}
