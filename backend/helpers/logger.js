/**
 * @fileoverview App main and debug logger
 * @module helpers/logger
 * @requires {@link external:fs}
 * @requires {@link external:pino}
 * @requires {@link external:pino-debug}
 * @requires {@link external:pino-multi-stream}
 * @requires {@link external:debug}
 * @requires config
 */

const fs = require('fs');
const pino = require('pino');
const { multistream } = require('pino-multi-stream');
const loggerCfg = require('../config/logger');


/**
 * Creates streams depending current execution environment
 * @function getStreams
 * @private
 * @param  {external:Error}     req  - Request received
 * @param  {external:Response}  res  - Response to be send
 * @param  {nextMiddleware}     next - Callback to pass control to next middleware
 */
function getStreams() {
  const streams = [];
  if (process.env.NODE_ENV === 'test') return streams;
  if (process.env.NODE_ENV === 'development') {
    streams.push({
      level: loggerCfg.debugLevel,
      stream: process.stderr,
    });
    streams.push({
      level: loggerCfg.debugLevel,
      stream: fs.createWriteStream(loggerCfg.debugFile, { flag: 'a' }),
    });
  }
  streams.push({
    level: loggerCfg.logLevel,
    stream: fs.createWriteStream(loggerCfg.logFile, { flag: 'a' }),
  });
  return streams;
}

/**
 * Exports logger
 * @private
 * @returns {Object}  logger
 */
const logger = pino({ level: loggerCfg.debugLevel }, multistream(getStreams()));

module.exports = logger;
