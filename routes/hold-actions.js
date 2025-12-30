'use strict';

const config = require('../config/zonemta.js');

function isHardFailure(message) {
    const err = message.lastError || '';
    return /user unknown|mailbox not found|no such user/i.test(err);
}

module.exports = (redis, hold, zonemta) => ({
    async release(req, res) {
        const key = `hold:${req.params.id}`;
        const raw = await redis.get(key);

        if (!raw) return res.redirect('/hold');

        const data = JSON.parse(raw);
        const recipient = data.message.envelope.to[0];

        if (await hold.isSuppressed(recipient)) {
            await redis.del(key);
            return res.redirect('/hold');
        }

        if (data.retryCount >= config.RETRY_AFTER_HOLD) {
            if (isHardFailure(data.message)) {
                await hold.suppress(recipient);
            }
            await redis.del(key);
            return res.redirect('/hold');
        }

        try {
            await zonemta.requeue(data.message);

            data.retryCount++;
            data.holdUntil =
                Date.now() +
                config.RETRY_BASE_DELAY_MS * data.retryCount;

            await redis.set(key, JSON.stringify(data));
        } catch (err) {
            console.error(
                "Failed to release hold message",
                data.message.id,
                err.message
            );
        }

        res.redirect('/hold');
    },

    async suppress(req, res) {
        const key = `hold:${req.params.id}`;
        const raw = await redis.get(key);

        if (raw) {
            const data = JSON.parse(raw);
            await hold.suppress(data.message.envelope.to[0]);
            await redis.del(key);
        }

        res.redirect('/hold');
    }
});