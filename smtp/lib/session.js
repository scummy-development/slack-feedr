import * as config from './config.js';
import {
  DefaultResponse,
  ResponseCode,
  SmtpCommand,
  SmtpParams,
} from './constants.js';
import {
  BadSequenceException,
  NotImplementedException,
  ParamsException,
  SmtpException,
} from './exceptions.js';
import { SmtpTransaction } from './transaction.js';

export const RE_MAIL_PARAM = /^(\w+): ?<([^>]+)>/i;
export const RE_LINE_COMMAND_AND_PARAMS = /^(\w+)(?:\s+(.*))?$/;

export class SmtpSession {
  #connection;

  /** @type {SmtpTransaction|null} */
  #trx = null;

  #isInitialized = false;

  #isExtended = false;

  /** @type {Record<keyof SmtpCommand, (params: string) => void | Promise<void>} */
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
   * @param {SmtpException|Error} e
   */
  #handleCommandException(e) {
    console.error(e);

    if (e instanceof SmtpException) {
      return this.#writeResponse(e.responseCode, e.message);
    }

    return this.#writeResponse(ResponseCode.UNRECOGNIZED, e.message);
  }

  /**
   * @param {string} line
   */
  #handleLine(line) {
    const [, commandStr, params] = line.match(RE_LINE_COMMAND_AND_PARAMS) ?? [];

    /** @type {keyof SmtpCommand} */
    const command = commandStr.toUpperCase();

    const handler = this.#commands[command];

    try {
      if (!handler) {
        throw new NotImplementedException('Command not recognized');
      }

      console.log('Handling command: %o, Params: %o', command, params);

      return handler.call(this, params);
    } catch (e) {
      return this.#handleCommandException(e);
    }
  }

  #abortTransaction() {
    this.#trx = null;

    console.log('Transaction aborted');
  }

  #initialize() {
    if (this.#trx !== null) {
      this.#abortTransaction();
    }

    this.#isExtended = false;
    this.#isInitialized = true;

    console.log('Session initialized');
  }

  #enabledExtendedMode() {
    this.#isExtended = true;

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
      throw new ParamsException('HELO command does not accept parameters');
    }

    this.#initialize();

    return this.#writeResponse(ResponseCode.OK, config.serverName);
  }

  /**
   * @param {string} paramStr
   * @returns {[string|null, string|null]}
   */
  #parseMailParam(paramStr) {
    const match = paramStr.match(RE_MAIL_PARAM);

    if (!match) {
      return [null, null];
    }

    const [, paramName, paramValue] = match;

    return [paramName.toUpperCase(), paramValue];
  }

  /**
   * @param {string} from
   */
  #startTransaction(from) {
    this.#trx = new SmtpTransaction(from);

    console.log('Transaction started');
  }

  /**
   * @param {string} paramsStr
   */
  async #handleMail(paramsStr) {
    if (!this.#isInitialized) {
      throw new BadSequenceException('Session not initialized');
    }

    if (this.#trx) {
      throw new BadSequenceException('Transaction already started');
    }

    const [param1, ...rest] = paramsStr.split(' ');

    console.log('Mail params: %o, parsed: %o', paramsStr, {
      param1,
      rest,
    });

    if (rest.length > 0) {
      throw new ParamsException('Too many parameters');
    }

    const [param, from] = this.#parseMailParam(param1);

    if (param !== SmtpParams.FROM) {
      throw new ParamsException('Unknown parameter');
    }

    if (!from) {
      throw new ParamsException('FROM address not found');
    }

    console.log('Mail from: %o', from);

    await this.#startTransaction(from);

    return this.#writeResponse(ResponseCode.OK);
  }

  /**
   * @param {string} params
   */
  #handleRcpt(params) {
    if (!this.#trx) {
      throw new BadSequenceException('Transaction not started');
    }

    const [param1, ...rest] = params.split(' ');

    if (rest.length > 0) {
      throw new ParamsException('Too many parameters');
    }

    const [param, rcpt] = this.#parseMailParam(param1);

    if (param !== SmtpParams.TO) {
      throw new ParamsException('Unknown parameter');
    }

    if (!rcpt) {
      throw new ParamsException('TO address not found');
    }

    this.#trx.addRecipient(rcpt);

    console.log('Rcpt trx: %o', this.#trx);

    return this.#writeResponse(ResponseCode.OK);
  }

  /**
   * @param {string} params
   * @todo Implement command
   */
  #handleData(params) {
    console.log('DATA params: %o', params);

    throw new NotImplementedException('DATA command not implemented');
  }

  /**
   * @param {string} params
   */
  async #handleRset(params) {
    if (params) {
      throw new ParamsException('RSET command does not accept parameters');
    }

    await this.#abortTransaction();

    return this.#writeResponse(ResponseCode.OK);
  }

  /**
   * @param {string} params
   */
  #handleNoop(params) {
    if (params) {
      throw new ParamsException('NOOP command does not accept parameters');
    }

    return this.#writeResponse(ResponseCode.OK);
  }

  /**
   * @param {string} params
   */
  async #handleQuit(params) {
    if (params) {
      throw new ParamsException('QUIT command does not accept parameters');
    }

    await this.#writeResponse(ResponseCode.CLOSING);

    return this.#connection.end();
  }

  /**
   * @param {string} params
   * @todo Implement command
   */
  #handleVrfy(params) {
    console.log('VRFY params: %o', params);

    throw new NotImplementedException('VRFY command not implemented');
  }

  /**
   * @param {string} params
   */
  #handleHelp(params) {
    if (params) {
      throw new ParamsException('HELP command does not accept parameters');
    }

    return this.#writeResponse(
      ResponseCode.HELP,
      `Commands: ${Object.keys(this.#commands).join(' ')}`,
    );
  }
}
