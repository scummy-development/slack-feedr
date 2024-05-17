/* eslint-disable @typescript-eslint/no-unused-vars */
import EventEmitter from 'events';
import { Server, Socket } from 'net';
import { SmtpGatewayEvents } from './constants.js';
import { SmtpConnection } from './smtp-connection.js';

const eventValues = Object.values(SmtpGatewayEvents);

export class SmtpGateway extends EventEmitter {
  serverName;

  #server = new Server();
  #connections = new WeakMap();

  constructor(serverName = 'localhost') {
    super();

    this.serverName = serverName;

    this.#server.on('close', this.#handleClose.bind(this));
    this.#server.on('connection', this.#handleConnection.bind(this));
    this.#server.on('error', this.#handleError.bind(this));
    this.#server.on('listening', this.#handleListening.bind(this));
    this.#server.on('drop', this.#handleDrop.bind(this));
  }

  /** @param {number} port */
  async listen(port) {
    this.#server.listen(port);
  }

  /**
   * @param {SmtpGatewayEvents[keyof SmtpGatewayEvents]} event
   * @param  {...any} args
   */
  async emit(event, ...args) {
    event = event.toLowerCase();

    if (!eventValues.includes(event)) {
      throw new Error(`Unknown ${this.constructor.name} event: ${event}`);
    }

    super.emit(event, ...args);
  }

  #handleClose() {
    console.log('Server closed');
  }

  /** @param {Socket} socket */
  #handleConnection(socket) {
    this.#connections.set(socket, new SmtpConnection(socket, this));
  }

  /** @param {Error} err */
  #handleError(err) {
    console.error(err);
  }

  #handleListening() {
    console.log(`SMTP listening on port %d`, this.#server.address().port);
  }

  /** @param {net.DropArgument|undefined} data */
  #handleDrop(data) {
    console.log('Connection dropped', data);
  }
}
