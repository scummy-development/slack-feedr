import * as config from './config.js';
import { ResponseCode, SmtpCommand } from './constants.js';

export const MAIL_FROM_MATCHER = /^FROM: ?<([^>]+)>/i;

class SessionTransaction {
  from;

  /**
   * @param {*} from
   */
  constructor(from) {
    this.from = from;
  }
}

export class SmtpSession {
  #connection;
  #trx = null;
  #isInitialized = false;
  #isExtended = false;

  #commands = {
    [SmtpCommand.EHLO]: this.#handleEhlo,
    [SmtpCommand.HELO]: this.#handleHelo,
    [SmtpCommand.MAIL]: this.#handleMail,
    [SmtpCommand.RCPT]: this.#handleRcpt,
    [SmtpCommand.DATA]: this.#handleData,
    [SmtpCommand.RSET]: this.#handleRset,
    [SmtpCommand.NOOP]: this.#handleNoop,
    [SmtpCommand.QUIT]: this.#handleQuit,
    [SmtpCommand.VRFY]: this.#handleVrfy,
    [SmtpCommand.HELP]: this.#handleHelp,
  };

  /**
   * @param {SmtpConnection} connection
   **/
  constructor(connection) {
    this.#connection = connection;
    this.#connection.on('line', this.#handleLine.bind(this));
  }

  sendReady() {
    return this.#connection.write(
      ResponseCode.READY,
      `${config.serverName} Service ready`,
    );
  }

  /**
   * @param {string} line
   */
  async #handleLine(line) {
    const [, command, params] =
      line.match(/^([^\s\r\n]+)(?: | ([^\r\n]+))?$/) ?? [];

    console.log('Handling command: %o, Params: %o', command, params);

    const handler =
      this.#commands[command.toUpperCase()] ?? this.#handleNotImplemented;

    await handler.call(this, params);
  }

  /**
   * @param {string} params
   */
  async #handleEhlo(params) {
    this.#initialize();
    this.#enabledExtendedMode();

    await this.#connection.write(
      ResponseCode.OKAY,
      this.#createExtendedGreeting(params),
    );
  }

  /**
   * @param {string} params
   */
  async #handleHelo(params) {
    if (params) {
      return this.#handleParamError(SmtpCommand.HELO, params);
    }

    this.#initialize();

    await this.#connection.write(
      ResponseCode.OKAY,
      config.serverName.toUpperCase(),
    );
  }

  /**
   * @param {string} params
   */
  async #handleMail(params) {
    if (!this.#trx) {
      await this.#connection.write(
        ResponseCode.BAD_SEQUENCE,
        'Bad sequence of commands',
      );

      return;
    }

    const [, from] = params?.match(MAIL_FROM_MATCHER) ?? [];

    console.log('Mail from: %o', from);

    if (!from) {
      await this.#connection.write(
        ResponseCode.PARAM_ERR,
        'Invalid parameter for MAIL',
      );

      return;
    }

    await this.#connection.write(ResponseCode.OKAY, `OK`);
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

    this.#startTransaction();
    await this.#connection.write(ResponseCode.OKAY, `OK`);
  }

  /**
   * @param {string} params
   */
  async #handleNoop(params) {
    if (params) {
      return this.#handleParamError('NOOP', params);
    }

    await this.#connection.write(ResponseCode.OKAY, `OK`);
  }

  /**
   * @param {string} params
   */
  async #handleQuit(params) {
    if (params) {
      return this.#handleParamError('QUIT', params);
    }

    await this.#connection.write(ResponseCode.CLOSING, `Closing`);
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
      ResponseCode.HELP,
      `Commands: ${Object.keys(this.#commands).join(' ')}`,
      'another line',
    );
  }

  /**
   * @param {string} command
   * @param {string} params
   */
  async #handleNotImplemented(command, params) {
    console.log('Command not implemented: %o, Params: %o', command, params);

    await this.#connection.write(
      ResponseCode.NOT_IMPLEMENTED,
      `Command not implemented`,
    );
  }

  async #handleParamError(
    command,
    params,
    message = `Invalid parameter for ${command}`,
  ) {
    console.log('Parameter error: %o, Params: %o', command, params);

    await this.#connection.write(ResponseCode.PARAM_ERR, message);
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

  /**
   * @param {string} from
   */
  #startTransaction(from) {
    this.#trx = new SessionTransaction(from);

    console.log('Transaction started');
  }

  #abortTransaction() {
    if (this.#trx === null) {
      return;
    }

    this.#trx = null;

    console.log('Transaction aborted');
  }

  #enabledExtendedMode() {
    this.#isExtended = true;

    console.log('Extended mode enabled');
  }

  #initialize() {
    if (this.#isInitialized) {
      this.#isExtended = false;
      this.#abortTransaction();

      console.log('Session re-initialized');

      return;
    }

    this.#isInitialized = true;

    console.log('Session initialized');
  }
}
