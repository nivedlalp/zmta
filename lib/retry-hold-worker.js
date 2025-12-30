'use strict';

const config = require("../config/zonemta.js");

function isHardFailure(message) {
    const err = message?.lastError || '';
    return /user unknown|mailbox not found|no such user/i.test(err);
}

module.exports = async (redis, hold, zonemta) => {
    let cursor = "0";

    do {
        const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            "hold:*",
            "COUNT",
            100
        );
        cursor = nextCursor;

        for (const key of keys) {
            const lockKey = `lock:${key}`;
            const locked = await redis.set(
                lockKey,
                "1",
                "NX",
                "EX",
                config.RETRY_LOCK_TTL
            );
            if (!locked) continue;

            const raw = await redis.get(key);
            if (!raw) continue;

            let data;
            try {
                data = JSON.parse(raw);
            } catch (err) {
                console.error('Failed to parse hold data for', key, err.message);
                await redis.del(key); 
                continue;
            }

            if (!data?.message) continue;

            if (Date.now() < data.holdUntil) continue;

            const recipient = data.message.envelope?.to?.[0];
            if (!recipient) {
                console.error('Invalid message envelope in', key);
                await redis.del(key);
                continue;
            }

            if (await hold.isSuppressed(recipient)) {
                await redis.del(key);
                continue;
            }

            if (data.retryCount >= config.RETRY_AFTER_HOLD) {
                if (isHardFailure(data.message)) {
                    console.log('SUPPRESS', recipient);
                    await hold.suppress(recipient);
                }
                await redis.del(key);
                continue;
            }

            try {
                await zonemta.requeue(data.message);

                data.retryCount = (data.retryCount || 0) + 1;
                data.holdUntil =
                    Date.now() +
                    config.RETRY_BASE_DELAY_MS * Math.pow(2, data.retryCount);
                await redis.set(key, JSON.stringify(data));
                console.log('RETRY', data.message.id, data.retryCount);
            } catch (err) {
                console.error(
                    "Failed to requeue hold message",
                    data.message?.id,
                    err.message
                );
            }
        }
    } while (cursor !== "0");
};