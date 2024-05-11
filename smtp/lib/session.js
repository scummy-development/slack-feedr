import * as config from './config.js';
import {
  CMD_DATA,
  CMD_EHLO,
  CMD_HELO,
  CMD_HELP,
  CMD_MAIL,
  CMD_NOOP,
  CMD_QUIT,
  CMD_RCPT,
  CMD_RSET,
  CMD_VRFY,
  CODE_BAD_SEQUENCE,
  CODE_CLOSING,
  CODE_HELP,
  CODE_NOT_IMPLEMENTED,
  CODE_OKAY,
  CODE_PARAM_ERR,
} from './constants.js';

class SessionState {
  isExtended = false;
}

export class SmtpSession {
  #connection;
  #state;

  #commands = {
    [CMD_EHLO]: this.#handleEhlo,
    [CMD_HELO]: this.#handleHelo,
    [CMD_MAIL]: this.#handleMail,
    [CMD_RCPT]: this.#handleRcpt,
    [CMD_DATA]: this.#handleData,
    [CMD_RSET]: this.#handleRset,
    [CMD_NOOP]: this.#handleNoop,
    [CMD_QUIT]: this.#handleQuit,
    [CMD_VRFY]: this.#handleVrfy,
    [CMD_HELP]: this.#handleHelp,
  };

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

    const handler =
      this.#commands[command.toUpperCase()] ?? this.#handleNotImplemented;

    await handler.call(this, params);
  }

  /**
   * @param {string} params
   */
  async #handleEhlo(params) {
    this.#loadNewState();
    this.#enabledExtendedMode();

    await this.#connection.write(
      CODE_OKAY,
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

    this.#loadNewState();

    await this.#connection.write(CODE_OKAY, config.serverName.toUpperCase());
  }

  /**
   * @param {string} params
   */
  async #handleMail(params) {
    console.log('Mail: %o', params);
    if (!this.#state) {
      await this.#connection.write(
        CODE_BAD_SEQUENCE,
        'Bad sequence of commands',
      );
      return;
    }

    await this.#connection.write(CODE_OKAY, `OK`);
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

    this.#loadNewState();
    await this.#connection.write(CODE_OKAY, `OK`);
  }

  /**
   * @param {string} params
   */
  async #handleNoop(params) {
    if (params) {
      return this.#handleParamError('NOOP', params);
    }

    await this.#connection.write(CODE_OKAY, `OK`);
  }

  /**
   * @param {string} params
   */
  async #handleQuit(params) {
    if (params) {
      return this.#handleParamError('QUIT', params);
    }

    await this.#connection.write(CODE_CLOSING, `Closing`);
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
      CODE_HELP,
      `Commands: ${Object.keys(this.#commands).join(' ')}`,
      'another line',
    );
  }

  async #handleParamError(
    command,
    params,
    message = `Invalid parameter for ${command}`,
  ) {
    console.log('Parameter error: %o, Params: %o', command, params);

    await this.#connection.write(CODE_PARAM_ERR, message);
  }

  /**
   * @param {string} command
   * @param {string} params
   */
  async #handleNotImplemented(command, params) {
    console.log('Command not implemented: %o, Params: %o', command, params);

    await this.#connection.write(
      CODE_NOT_IMPLEMENTED,
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

  #loadNewState() {
    this.#state = new SessionState();

    console.log('New state created');
  }

  #enabledExtendedMode() {
    this.#state.isExtended = true;

    console.log('Extended mode enabled');
  }
}
