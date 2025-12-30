'use strict';

const config = require('../config/zonemta.js');

module.exports = async (redis, hold, zonemta) => {
    const { data } = await zonemta.getFailedMessages(redis);

    for (const msg of data) {
        if (msg.attempts < config.ZONEMTA_RETRY_LIMIT) {
            continue;
        }

        const key = `hold:${msg.id}`;

        const created = await redis.set(
            key,
            JSON.stringify({
                message: {
                    id: msg.id,
                    envelope: msg.envelope,
                    queue: msg.queue,
                    lastError: msg.lastError
                },
                retryCount: 0,
                holdUntil: Date.now() + config.HOLD_HOURS * 3600000
            }),
            'NX'
        );

        if (!created) continue;

        console.log('HELD', msg.id);
        await zonemta.remove(redis, msg);
    }
};
