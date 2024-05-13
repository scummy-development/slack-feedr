import * as config from './config.js';
import { DefaultResponse, ResponseCode, SmtpCommand } from './constants.js';

export const MAIL_FROM_MATCHER = /^FROM: ?<([^>]+)>/i;

class SessionTransaction {
  from;

  /**
   * @param {string} from
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
    return this.#writeResponse(ResponseCode.READY);
  }

  #writeResponse(code, ...messages) {
    if (!messages.length) {
      const defaultMessage = DefaultResponse[code];

      if (defaultMessage) {
        messages.push(defaultMessage);
      }
    }

    return this.#connection.write(code, ...messages);
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
  #handleEhlo(params) {
    this.#initialize();
    this.#enabledExtendedMode();

    return this.#writeResponse(
      ResponseCode.OK,
      this.#createExtendedGreeting(params),
    );
  }

  /**
   * @param {string} params
   */
  #handleHelo(params) {
    if (params) {
      return this.#handleParamError(SmtpCommand.HELO, params);
    }

    this.#initialize();

    return this.#writeResponse(
      ResponseCode.OK,
      config.serverName.toUpperCase(),
    );
  }

  /**
   * @param {string} params
   */
  #handleMail(params) {
    this.#startTransaction();

    const [, from] = params?.match(MAIL_FROM_MATCHER) ?? [];

    console.log('Mail from: %o', from);

    if (!from) {
      return this.#writeResponse(ResponseCode.PARAM_ERR);
    }

    return this.#writeResponse(ResponseCode.OK);
  }

  /**
   * @param {string} params
   * @todo Implement command
   */
  #handleRcpt(params) {
    return this.#handleNotImplemented('RCPT', params);
  }

  /**
   * @param {string} params
   * @todo Implement command
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

    await this.#abortTransaction();

    return this.#writeResponse(ResponseCode.OK);
  }

  /**
   * @param {string} params
   */
  #handleNoop(params) {
    if (params) {
      return this.#handleParamError('NOOP', params);
    }

    return this.#writeResponse(ResponseCode.OK);
  }

  /**
   * @param {string} params
   */
  async #handleQuit(params) {
    if (params) {
      return this.#handleParamError('QUIT', params);
    }

    await this.#writeResponse(ResponseCode.CLOSING);

    return this.#connection.end();
  }

  /**
   * @param {string} params
   * @todo Implement command
   */
  #handleVrfy(params) {
    return this.#handleNotImplemented('VRFY', params);
  }

  async #handleHelp(params) {
    if (params) {
      return this.#handleParamError('HELP', params);
    }

    await this.#writeResponse(
      ResponseCode.HELP,
      `Commands: ${Object.keys(this.#commands).join(' ')}`,
    );
  }

  /**
   * @param {string} command
   * @param {string} params
   */
  async #handleNotImplemented(command, params) {
    console.log('Command not implemented: %o, Params: %o', command, params);

    await this.#writeResponse(ResponseCode.NOT_IMPLEMENTED);
  }

  async #handleParamError(
    command,
    params,
    message = `Invalid parameter for ${command}`,
  ) {
    console.log('Parameter error: %o, Params: %o', command, params);

    await this.#writeResponse(ResponseCode.PARAM_ERR, message);
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
  async #startTransaction(from) {
    if (this.#trx) {
      await this.#writeResponse(ResponseCode.BAD_SEQUENCE);

      return;
    }

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
