import EventEmitter from 'events';
import * as net from 'net';
import { SmtpConnection } from './connection.js';

export class SmtpGateway extends EventEmitter {
  #server = new net.Server();
  #connections = new WeakMap();

  constructor() {
    super();

    this.#server.on('close', this.#handleClose.bind(this));
    this.#server.on('connection', this.#handleConnection.bind(this));
    this.#server.on('error', this.#handleError.bind(this));
    this.#server.on('listening', this.#handleListening.bind(this));
    this.#server.on('drop', this.#handleDrop.bind(this));
  }

  /**
   * @param {number} port
   */
  async listen(port) {
    await this.#server.listen(port);
  }

  #handleClose() {
    console.log('Server closed');
  }

  /**
   * @param {net.Socket} socket
   */
  #handleConnection(socket) {
    console.log('Connection established', socket.address());

    this.#connections.set(socket, new SmtpConnection(socket, this));
  }

  /**
   * @param {Error} err
   */
  #handleError(err) {
    console.error(err);
  }

  #handleListening() {
    console.log(`SMTP listening on port %d`, this.#server.address().port);
  }

  /**
   * @param {net.DropArgument|undefined} data
   */
  #handleDrop(data) {
    console.log('Connection dropped', data);
  }
}
