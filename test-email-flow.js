const Redis = require('ioredis');
const redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
    db: 2
});
const moment = require('moment');
const config = require('./config/zonemta');

const heldMessages = [
    { id: 'msg1', recipient: 'user1@example.com' },
    { id: 'msg2', recipient: 'user2@example.com' }
];

async function holdWorker() {
    const now = Date.now();
    for (const msg of heldMessages) {
        const holdUntil = now + config.HOLD_HOURS * 3600000; // config value
        await redis.set(
            `hold:${msg.id}`,
            JSON.stringify({ retryCount: 0, holdUntil, recipient: msg.recipient })
        );
        console.log(`[ZoneMTA] HELD ${msg.id} until ${new Date(holdUntil).toLocaleTimeString()}`);
    }
}

async function checkHeldMessages() {
    const keys = await redis.keys('hold:*');
    const now = Date.now();

    for (const key of keys) {
        const data = JSON.parse(await redis.get(key));
        data.retryCount += 1;

        if (data.retryCount >= config.RETRY_AFTER_HOLD || data.holdUntil <= now) {
            // Suppress
            await redis.set(
                `suppressed:${data.recipient}`,
                'true',
                'EX',
                config.SUPPRESS_DAYS * 24 * 60 * 60
            );
            await redis.del(key);
            console.log(`[ZoneMTA] Released ${key.replace('hold:', '')} and suppressed ${data.recipient}`);
        } else {
            // Simulate requeue with exponential backoff
            const backoff = Math.min(
                config.RETRY_BASE_DELAY_MS * Math.pow(2, data.retryCount),
                config.HOLD_HOURS * 3600000 // maximum hold duration = 1 minute
            );
            data.holdUntil = now + backoff;
            await redis.set(key, JSON.stringify(data));
            console.log(`Held message: ${key.replace('hold:', '')} retryCount: ${data.retryCount}, next attempt at ${new Date(data.holdUntil).toLocaleTimeString()}`);
        }
    }
}

async function checkSuppressedEmails() {
    const emails = heldMessages.map(m => m.recipient);
    console.log('Suppressed emails:');
    for (const email of emails) {
        const suppressed = await redis.get(`suppressed:${email}`) === 'true';
        console.log(`${email} suppressed? ${suppressed}`);
    }
}

(async () => {
    console.log('--- Starting Test ---\n');
    await holdWorker();

    let attempt = 1;
    const interval = setInterval(async () => {
        console.log(`\n[Retry Worker] Attempt #${attempt}`);
        await checkHeldMessages();
        await checkSuppressedEmails();

        attempt++;
        if (attempt > config.RETRY_AFTER_HOLD + 2) { // stop after a few cycles
            clearInterval(interval);
            console.log('\n--- Test Complete ---');
            process.exit(0);
        }
    }, config.WORKER_INTERVAL_MS);
})();
