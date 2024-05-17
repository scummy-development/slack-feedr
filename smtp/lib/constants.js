import * as config from './config.js';

export const SmtpCommand = Object.freeze({
  DATA: 'DATA',
  EHLO: 'EHLO',
  HELO: 'HELO',
  HELP: 'HELP',
  MAIL: 'MAIL',
  NOOP: 'NOOP',
  QUIT: 'QUIT',
  RCPT: 'RCPT',
  RSET: 'RSET',
  VRFY: 'VRFY',
});

export const SmtpParams = Object.freeze({
  FROM: 'FROM',
  TO: 'TO',
});

export const SessionMode = Object.freeze({
  UNINITIALIZED: 0,
  COMMAND: 1,
  DATA: 2,
});

export const ResponseCode = Object.freeze({
  HELP: 214,
  READY: 220,
  CLOSING: 221,
  OK: 250,
  UNRECOGNIZED: 500,
  PARAM_ERR: 501,
  NOT_IMPLEMENTED: 502,
  BAD_SEQUENCE: 503,
});

export const DefaultResponse = Object.freeze({
  [ResponseCode.READY]: `${config.serverName} Service ready`,
  [ResponseCode.CLOSING]: 'Closing connection',
  [ResponseCode.OK]: 'OK',
  [ResponseCode.UNRECOGNIZED]: 'Unrecognized command',
  [ResponseCode.NOT_IMPLEMENTED]: 'Command not implemented',
  [ResponseCode.BAD_SEQUENCE]: 'Bad sequence of commands',
});

export const CRLF = '\r\n';
