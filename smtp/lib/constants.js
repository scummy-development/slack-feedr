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

export const ResponseCode = Object.freeze({
  HELP: 214,
  READY: 220,
  CLOSING: 221,
  OKAY: 250,
  UNRECOGNIZED: 500,
  PARAM_ERR: 501,
  NOT_IMPLEMENTED: 502,
  BAD_SEQUENCE: 503,
});

export const CRLF = '\r\n';
