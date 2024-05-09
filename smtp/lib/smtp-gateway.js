import EventEmitter from 'events';
import * as net from 'net';
import * as config from './config.js';

class SessionState {
  isExtended = false;
}

class SmtpSession {
  #connection;
  #state = new SessionState();

  constructor(connection) {
    this.#connection = connection;
    this.#connection.on('line', this.#handleLine.bind(this));
  }

  /**
   * @private
   */
  #resetState() {
    this.#state = new SessionState();
    console.log('Session state reset');
  }

  /**
   * @param {string} line
   * @private
   */
  #handleLine(line) {
    const [, command, params] =
      line.match(/^([^\s\r\n]+)(?: | ([^\r\n]+))?$/) ?? [];

    console.log('Handling command: %o, Params: %o', command, params);

    switch (command.toUpperCase()) {
      case 'EHLO':
        this.#handleEhlo(params);
        break;
      case 'HELO':
        this.#handleHelo(params);
        break;
      case 'RSET':
        this.#handleRset(params);
        break;
      // case 'MAIL':
      //   this.#handleMail(params);
      //   break;
      // case 'RCPT':
      //   this.#handleRcpt(params);
      //   break;
      // case 'DATA':
      //   this.#handleData(params);
      //   break;
      // case 'QUIT':
      //   this.#handleQuit(params);
      //   break;
      default:
        this.#connection.write(`500 Command not recognized`);
    }
  }

  /**
   * @private
   */
  #enabledExtendedMode() {
    this.#state.isExtended = true;
    console.log('Extended mode enabled');
  }

  /**
   * @param {string} params
   * @private
   */
  #createExtendedGreeting(params) {
    let greeting = config.serverName;

    if (params) {
      const [clientName] = params.split(' ', 1);
      if (clientName) {
        greeting += ` greets ${clientName}`;
      }
    }

    return greeting;
  }

  /**
   * @param {string} params
   * @private
   */
  #handleEhlo(params) {
    this.#resetState();
    this.#enabledExtendedMode();

    this.#connection.write(
      `250-${this.#createExtendedGreeting(params)}`,
      '250 HELP',
    );
  }

  /**
   * @private
   */
  #handleHelo() {
    this.#resetState();
    this.#connection.write(`250 ${config.serverName.toUpperCase()}`);
  }

  /**
   * @private
   */
  #handleRset() {
    this.#resetState();
    this.#connection.write(`250 OK`);
  }
}

const CRLF = '\r\n';

class SmtpConnection extends EventEmitter {
  #socket;
  #gateway;
  #session;
  #buffer = '';

  /**
   * @param {net.Socket} socket
   * @param {SmtpGateway} gateway
   */
  constructor(socket, gateway) {
    super();

    this.#socket = socket;
    this.#gateway = gateway;
    this.#session = new SmtpSession(this);

    this.#socket.on('data', this.#handleData.bind(this));
    this.#socket.on('end', this.#handleEnd.bind(this));

    this.#socket.write(`220${CRLF}`);
  }

  /**
   *
   * @param {string} lines
   */
  write(...lines) {
    this.#socket.write(lines.join(CRLF) + CRLF);
  }

  /**
   * @private
   */
  #clearBuffer() {
    this.#buffer = '';
  }

  /**
   * @param {Buffer} data
   * @private
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

  /**
   * @private
   */
  #handleEnd() {
    console.log('Connection closed');
  }

  static lineEndSequence = Buffer.from('\r\n', 'ascii');
  static dataEndSequence = Buffer.from('\r\n.\r\n', 'ascii');
}

export class SmtpGateway {
  #server = new net.Server();
  #connections = [];

  constructor() {
    this.#server.on('close', this.#handleClose.bind(this));
    this.#server.on('connection', this.#handleConnection.bind(this));
    this.#server.on('error', this.#handleError.bind(this));
    this.#server.on('listening', this.#handleListening.bind(this));
    this.#server.on('drop', this.#handleDrop.bind(this));
  }

  async listen(port) {
    await this.#server.listen(port);
  }

  /**
   * @private
   */
  #handleClose() {
    console.log('Server closed');
  }

  /**
   * @param {net.Socket} socket
   */
  #handleConnection(socket) {
    console.log('Connection established', socket.address());

    this.#connections.push(new SmtpConnection(socket, this));
  }

  /**
   * @param {Error} err
   * @private
   */
  #handleError(err) {
    console.error(err);
  }

  /**
   * @private
   */
  #handleListening() {
    console.log(`SMTP listening on port %d`, this.#server.address().port);
  }

  /**
   * @param {net.DropArgument|undefined} data
   * @private
   */
  #handleDrop(data) {
    console.log('Connection dropped', data);
  }
}
