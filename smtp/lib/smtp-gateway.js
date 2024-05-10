import EventEmitter from 'events';
import * as net from 'net';
import * as config from './config.js';
import * as codes from './response-codes.js';

class SessionState {
  isExtended = false;
}

class SmtpSession {
  #connection;
  #state = new SessionState();

  /**
   * @param {SmtpConnection} connection
   **/
  constructor(connection) {
    this.#connection = connection;
    this.#connection.on('line', this.#handleLine.bind(this));
  }

  #handleNotImplemented(command, params) {
    console.log('Command not implemented: %o, Params: %o', command, params);
    this.#connection.write(
      `${codes.NOT_IMPLEMENENTED} Command not implemented`,
    );
  }

  /**
   * @param {string} line
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
        this.#handleNotImplemented();
    }
  }

  #enabledExtendedMode() {
    this.#state.isExtended = true;
    console.log('Extended mode enabled');
  }

  /**
   * @param {string} params
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

  #resetState() {
    this.#state = new SessionState();
    console.log('Session state reset');
  }

  /**
   * @param {string} params
   */
  #handleEhlo(params) {
    this.#resetState();
    this.#enabledExtendedMode();

    this.#connection.write(
      codes.OKAY,
      this.#createExtendedGreeting(params),
      'HELP',
    );
  }

  #handleHelo() {
    this.#resetState();
    this.#connection.write(codes.OKAY, config.serverName.toUpperCase());
  }

  #handleRset() {
    this.#resetState();
    this.#connection.write(codes.OKAY, `OK`);
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

    this.write(codes.READY, `${config.serverName} Service ready`);
  }

  /**
   * @param {string[]} lines
   */
  write(code, ...lines) {
    const codedLines = lines.map(
      (line, i) => code + (i === lines.length - 1 ? ' ' : '-') + line,
    );

    if (codedLines.length === 0) {
      codedLines.push(code);
    }

    this.#socket.write(codedLines.join(CRLF) + CRLF);
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

export class SmtpGateway {
  #server = new net.Server();
  #connections = new WeakMap();

  constructor() {
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
