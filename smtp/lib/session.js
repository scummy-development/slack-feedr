import * as config from './config.js';
import { DefaultResponse, ResponseCode, SmtpCommand } from './constants.js';

export const RE_MAIL_PARAM = /^(\w+): ?<([^>]+)>/i;
export const RE_LINE_COMMAND_AND_PARAMS = /^(\w+)(?:\s+(.*))?$/;

class SessionTransaction {
  from;

  /**
   * @type {string[]}
   */
  rcpt = [];

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
    this.rcpt.push(rcpt);
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

  /**
   * @param {ResponseCode[keyof ResponseCode]} code
   * @param  {...string} messages
   */
  #writeResponse(code, ...messages) {
    if (!messages.length && DefaultResponse[code]) {
      return this.#connection.write(code, DefaultResponse[code]);
    }

    return this.#connection.write(code, ...messages);
  }

  /**
   * @param {string} line
   */
  #handleLine(line) {
    const [, commandStr, params] = line.match(RE_LINE_COMMAND_AND_PARAMS) ?? [];

    const command = commandStr.toUpperCase();

    console.log('Handling command: %o, Params: %o', command, params);

    const handler = this.#commands[command] ?? this.#handleNotImplemented;

    return handler.call(this, params);
  }

  /**
   * @param {string} params
   */
  #handleEhlo(params) {
    this.#initialize();
    this.#enabledExtendedMode();

    const extendedGreeting = this.#createExtendedGreeting(params);

    return this.#writeResponse(ResponseCode.OK, extendedGreeting);
  }

  /**
   * @param {string} params
   */
  #handleHelo(params) {
    if (params) {
      return this.#handleParamError(SmtpCommand.HELO, params);
    }

    this.#initialize();

    return this.#writeResponse(ResponseCode.OK, config.serverName);
  }

  /**
   * @param {string} paramsStr
   */
  async #handleMail(paramsStr) {
    if (this.#trx) {
      return this.#writeResponse(ResponseCode.BAD_SEQUENCE);
    }

    const [param1, ...rest] = paramsStr.split(' ');

    console.log('Mail params: %o, parsed: %o', paramsStr, {
      param1,
      rest,
    });

    const [, param, from] = param1.match(RE_MAIL_PARAM) ?? [];

    if (rest.length > 0) {
      return this.#handleParamError(
        SmtpCommand.MAIL,
        paramsStr,
        'Too many parameters',
      );
    }

    if (param?.toUpperCase() !== 'FROM') {
      return this.#handleParamError(
        SmtpCommand.MAIL,
        paramsStr,
        'Unknown parameter',
      );
    }

    if (!from) {
      return this.#handleParamError(
        SmtpCommand.MAIL,
        paramsStr,
        'FROM address not found',
      );
    }

    console.log('Mail from: %o', from);

    await this.#startTransaction(from);

    return this.#writeResponse(ResponseCode.OK);
  }

  /**
   * @param {string} params
   * @todo Implement command
   */
  #handleRcpt(params) {
    return this.#handleNotImplemented(SmtpCommand.RCPT, params);
  }

  /**
   * @param {string} params
   * @todo Implement command
   */
  #handleData(params) {
    return this.#handleNotImplemented(SmtpCommand.DATA, params);
  }

  /**
   * @param {string} params
   */
  async #handleRset(params) {
    if (params) {
      return this.#handleParamError(SmtpCommand.RSET, params);
    }

    await this.#abortTransaction();

    return this.#writeResponse(ResponseCode.OK);
  }

  /**
   * @param {string} params
   */
  #handleNoop(params) {
    if (params) {
      return this.#handleParamError(SmtpCommand.NOOP, params);
    }

    return this.#writeResponse(ResponseCode.OK);
  }

  /**
   * @param {string} params
   */
  async #handleQuit(params) {
    if (params) {
      return this.#handleParamError(SmtpCommand.QUIT, params);
    }

    await this.#writeResponse(ResponseCode.CLOSING);

    return this.#connection.end();
  }

  /**
   * @param {string} params
   * @todo Implement command
   */
  #handleVrfy(params) {
    return this.#handleNotImplemented(SmtpCommand.VRFY, params);
  }

  /**
   * @param {string} params
   */
  #handleHelp(params) {
    if (params) {
      return this.#handleParamError(SmtpCommand.HELP, params);
    }

    return this.#writeResponse(
      ResponseCode.HELP,
      `Commands: ${Object.keys(this.#commands).join(' ')}`,
    );
  }

  /**
   * @param {string} command
   * @param {string} params
   */
  #handleNotImplemented(command, params) {
    console.log('Command not implemented: %o, Params: %o', command, params);

    return this.#writeResponse(ResponseCode.NOT_IMPLEMENTED);
  }

  /**
   * @param {SmtpCommand[keyof SmtpCommand]} command
   * @param {string} params
   * @param {string} message
   */
  #handleParamError(
    command,
    params,
    message = `Invalid parameters for ${command}`,
  ) {
    console.log('Parameter error: %o, Params: %o', command, params);

    return this.#writeResponse(ResponseCode.PARAM_ERR, message);
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
    this.#trx = null;

    console.log('Transaction aborted');
  }

  #enabledExtendedMode() {
    this.#isExtended = true;

    console.log('Extended mode enabled');
  }

  #initialize() {
    if (this.#trx !== null) {
      this.#abortTransaction();
    }

    this.#isExtended = false;
    this.#isInitialized = true;

    console.log('Session initialized');
  }
}
