import { ResponseCode } from './constants.js';

export class SmtpException extends Error {
  /**
   * @param {ResponseCode[keyof ResponseCode]} responseCode
   * @param {string?} message
   * @param {any?} info
   **/
  constructor(responseCode = ResponseCode.ERROR, message, info) {
    super(message);

    this.name = this.constructor.name;
    this.responseCode = responseCode;
    this.info = info;
  }
}

export class BadSequenceException extends SmtpException {
  /**
   * @param {string?} message
   * @param {any?} info
   **/
  constructor(message, info) {
    super(ResponseCode.BAD_SEQUENCE, message, info);
  }
}

export class ParamsException extends SmtpException {
  /**
   * @param {string?} message
   * @param {any?} info
   **/
  constructor(message, info) {
    super(ResponseCode.PARAM_ERR, message, info);
  }
}

export class NotImplementedException extends SmtpException {
  /**
   * @param {string?} message
   * @param {any?} info
   **/
  constructor(message, info) {
    super(ResponseCode.NOT_IMPLEMENTED, message, info);
  }
}
