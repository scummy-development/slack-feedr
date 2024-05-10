import EventEmitter from 'events';
import * as net from 'net';
import * as config from './config.js';
import {
  CLOSING_CODE,
  HELP_CODE,
  NOT_IMPLEMENENTED_CODE,
  OKAY_CODE,
  PARAMETER_ERROR_CODE,
  READY_CODE,
} from './response-codes.js';

class SessionState {
  isExtended = false;
}

class SmtpSession {
  #connection;
  #state;

  /**
   * @param {SmtpConnection} connection
   **/
  constructor(connection) {
    this.#connection = connection;
    this.#connection.on('line', this.#handleLine.bind(this));
  }

  /**
   * @param {string} line
   */
  async #handleLine(line) {
    const [, command, params] =
      line.match(/^([^\s\r\n]+)(?: | ([^\r\n]+))?$/) ?? [];

    console.log('Handling command: %o, Params: %o', command, params);

    const handler = this.#handlers[command] ?? this.#handleNotImplemented;

    await handler.call(this, params);
  }

  #handlers = {
    EHLO: this.#handleEhlo,
    HELO: this.#handleHelo,
    MAIL: this.#handleMail,
    RCPT: this.#handleRcpt,
    DATA: this.#handleData,
    RSET: this.#handleRset,
    NOOP: this.#handleNoop,
    QUIT: this.#handleQuit,
    VRFY: this.#handleVrfy,
    HELP: this.#handleHelp,
  };

  /**
   * @param {string} params
   */
  async #handleEhlo(params) {
    this.#resetState();
    this.#enabledExtendedMode();

    await this.#connection.write(
      OKAY_CODE,
      this.#createExtendedGreeting(params),
    );
  }

  /**
   * @param {string} params
   */
  async #handleHelo(params) {
    if (params) {
      return this.#handleParamError('HELO', params);
    }

    this.#resetState();

    await this.#connection.write(OKAY_CODE, config.serverName.toUpperCase());
  }

  /**
   * @param {string} params
   */
  async #handleMail(params) {
    console.log('Mail: %o', params);

    await this.#connection.write(OKAY_CODE, `OK`);
  }

  /**
   * @param {string} params
   */
  #handleRcpt(params) {
    return this.#handleNotImplemented('RCPT', params);
  }

  /**
   * @param {string} params
   */
  #handleData(params) {
    return this.#handleNotImplemented('DATA', params);
  }

  /**
   * @param {string} params
   */
  async #handleRset(params) {
    if (params) {
      return this.#handleParamError('RSET', params);
    }

    this.#resetState();
    await this.#connection.write(OKAY_CODE, `OK`);
  }

  /**
   * @param {string} params
   */
  async #handleNoop(params) {
    if (params) {
      return this.#handleParamError('NOOP', params);
    }

    await this.#connection.write(OKAY_CODE, `OK`);
  }

  /**
   * @param {string} params
   */
  async #handleQuit(params) {
    if (params) {
      return this.#handleParamError('QUIT', params);
    }

    await this.#connection.write(CLOSING_CODE, `Closing`);
    await this.#connection.end();
  }

  /**
   * @param {string} params
   */
  #handleVrfy(params) {
    return this.#handleNotImplemented('VRFY', params);
  }

  async #handleHelp(params) {
    if (params) {
      return this.#handleParamError('HELP', params);
    }

    await this.#connection.write(
      HELP_CODE,
      `Commands: ${Object.keys(this.#handlers).join(' ')}`,
    );
  }

  async #handleParamError(
    command,
    params,
    message = `Invalid parameter for ${command}`,
  ) {
    console.log('Parameter error: %o, Params: %o', command, params);

    await this.#connection.write(PARAMETER_ERROR_CODE, message);
  }

  /**
   * @param {string} command
   * @param {string} params
   */
  async #handleNotImplemented(command, params) {
    console.log('Command not implemented: %o, Params: %o', command, params);

    await this.#connection.write(
      NOT_IMPLEMENENTED_CODE,
      `Command not implemented`,
    );
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

  #enabledExtendedMode() {
    this.#state.isExtended = true;

    console.log('Extended mode enabled');
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

    this.write(READY_CODE, `${config.serverName} Service ready`).catch(
      (err) => {
        console.error('Failed to write to socket', err);
      },
    );
  }

  /**
   * @param {number|string} code
   * @param {string[]} lines
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
