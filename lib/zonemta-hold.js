'use strict';

module.exports = {
    async getFailedMessages(redis) {
        const keys = await redis.keys("deferred:*");
        const messages = [];

        for (const key of keys) {
            const msg = JSON.parse(await redis.get(key));
            msg._redisKey = key; 
            messages.push(msg);
        }

        return { data: messages };
    },

    async requeue(redis, message) {
        const key = `deferred:${message.id}`;
        await redis.set(key, JSON.stringify(message));
    },

    async remove(redis, message) {
        const key = message._redisKey || `deferred:${message.id}`;
        await redis.del(key);
    }
};
