'use strict';

module.exports = (redis) => ({
    async list(req, res) {
        const items = [];
        let cursor = "0";

        do {
            const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "hold:*", "COUNT", 100);
            cursor = nextCursor;

            for (const key of keys) {
                const raw = await redis.get(key);
                if (!raw) continue;

                const data = JSON.parse(raw);

                items.push({
                    ...data,
                    lastError: data.lastError || 'Unknown',
                    message: data.message || { envelope: { to: ['unknown@example.com'] }, id: key.replace('hold:', '') }
                });
            }
        } while (cursor !== "0");

        res.render('hold', { items });
    }
});
