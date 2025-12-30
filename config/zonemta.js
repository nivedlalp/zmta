'use strict';

// module.exports = {
//     zonemtaConfigPath: '/home/nived/Documents/zoneMTA/zone-mta/config',

//     HOLD_HOURS: 12,
//     RETRY_AFTER_HOLD: 4,
//     SUPPRESS_DAYS: 30,
//     ZONEMTA_RETRY_LIMIT: 18,
//     WORKER_INTERVAL_MS: 5 * 60 * 1000,
// };


module.exports = { 
    zonemtaConfigPath: [
        '/home/nived/Documents/zoneMTA/zone-mta/config',
        '/home/nived/Documents/zoneMTA/zone-mta/config/interfaces',
        '/home/nived/Documents/zoneMTA/zone-mta/config/zones',
    ],
    HOLD_HOURS: 0.015,       // how long an email stays in the hold queue before retrying
    RETRY_AFTER_HOLD: 15,    // how many retry attempts are made after releasing from hold
    SUPPRESS_DAYS: 1,        // days to keep suppressed emails
    ZONEMTA_RETRY_LIMIT: 5,  // how many retries before holding
    WORKER_INTERVAL_MS: 4000,// workers run every 4 seconds
    RETRY_BASE_DELAY_MS: 10000,// base delay for exponential backoff (10s)
    RETRY_LOCK_TTL: 30       // lock TTL for retry worker
};