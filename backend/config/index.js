/**
 * @fileoverview This is global configuration
 * @module config
 */

const appCfg = require('./app.js');
const apiCfg = require('./api.js');
const dbCfg = require('./db.js');
const loggerCfg = require('./logger.js');

module.exports = { appCfg, apiCfg, dbCfg, loggerCfg };
