'use strict';

const crypto = require('crypto');
const config = require('../config/zonemta.js');

module.exports = redis => {
    return {
        async holdMessage(message) {
            const safeMessage = {
                id: message.id,
                envelope: message.envelope,
                queue: message.queue,
                lastError: message.lastError
            };

            const holdUntil =
                Date.now() + config.HOLD_HOURS * 60 * 60 * 1000;

            await redis.set(
                `hold:${message.id}`,
                JSON.stringify({
                    message: safeMessage,
                    retryCount: 0,
                    holdUntil
                }),
                'NX'
            );
        },

        async suppress(email) {
            const hash = crypto
                .createHash('sha256')
                .update(email)
                .digest('hex');

            await redis.set(
                `suppress:${hash}`,
                '1',
                'EX',
                config.SUPPRESS_DAYS * 24 * 60 * 60
            );
        },

        async isSuppressed(email) {
            const hash = crypto
                .createHash('sha256')
                .update(email)
                .digest('hex');

            return !!(await redis.get(`suppress:${hash}`));
        }
    };
};
