/**
 * Created by Thibaut on 23/07/2019.
 */
/**
 * Configurations of logger.
 */
const winston = require('winston');
const winstonRotator = require('winston-daily-rotate-file');

const consoleConfig = [
    new winston.transports.Console({
        'colorize': true
    })
];

const createLogger = new winston.Logger({
    'transports': consoleConfig
});

const successLogger = createLogger;
successLogger.add(winstonRotator, {
    'name': 'access-file',
    'level': 'info',
    'filename': './static/logs/%DATE%-access.log',
    'json': false,
    'datePattern: ': 'YYYY-MM-DD-HH',
    'prepend': true
});

const errorLogger = createLogger;
errorLogger.add(winstonRotator, {
    'name': 'error-file',
    'level': 'error',
    'filename': './static/logs/%DATE%-error.log',
    'json': false,
    'datePattern: ': 'YYYY-MM-DD-HH',
    'prepend': true
});

module.exports = {
    'successlog': successLogger,
    'errorlog': errorLogger
};