/**
 * Logger — Winston with console + file transports
 */

'use strict';

const { createLogger, format, transports } = require('winston');

const { combine, timestamp, printf, colorize, errors, json } = format;

const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true })
  ),
  transports: [
    new transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? combine(json())
        : combine(colorize(), devFormat),
    }),
  ],
  exitOnError: false,
});

if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  logger.add(new transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    format: combine(timestamp(), json()),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
  }));
  logger.add(new transports.File({
    filename: path.join('logs', 'combined.log'),
    format: combine(timestamp(), json()),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 10,
  }));
}

logger.http = (msg) => logger.log('http', msg);

module.exports = logger;
