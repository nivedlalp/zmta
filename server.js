'use strict';

const config = require('wild-config');
const log = require('npmlog');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./lib/db');
const logserver = require('./lib/logserver');
const zonemtaConfig = require("./config/zonemta.js");
const holdFactory = require('./lib/hold');
const zonemta = require('./lib/zonemta-hold');
const moment = require('moment');

const port = config.port;
const host = config.host;
log.level = config.log.level;

const os = require('os');

db.init(err => {
    if (err) throw err;

    const redis = db.redis;
    const hold = holdFactory(redis);
    const app = require('./app'); // your existing Express app

    // Body parser for form POSTs
    app.use(bodyParser.urlencoded({ extended: true }));

    // View engine
    app.set('view engine', 'hbs');

    // --- Routes ---

    // Display held emails
    app.get('/hold', async (req, res) => {
        try {
            const keys = await redis.keys('hold:*');
            const items = [];

            for (const key of keys) {
                const data = JSON.parse(await redis.get(key));
                const messageId = key.replace('hold:', '');
                items.push({
                    message: {
                        id: messageId,
                        envelope: { to: [`${messageId}@example.com`] } // mock recipient
                    },
                    retryCount: data.retryCount,
                    holdUntil: data.holdUntil
                });
            }

            res.render('hold', {
                items,
                formatDate: d => moment(d, 'hh:mm:ss A').format('MMM DD, YYYY hh:mm:ss A')
            });
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    // Release a held email
    app.post('/hold/:id/release', async (req, res) => {
        const messageId = req.params.id;
        await redis.del(`hold:${messageId}`);
        console.log(`[UI] Released ${messageId}`);
        res.redirect('/hold');
    });

    // Suppress an email
    app.post('/hold/:id/suppress', async (req, res) => {
        const messageId = req.params.id;
        const email = `${messageId}@example.com`; // mock envelope
        await redis.set(`suppressed:${email}`, 'true');
        console.log(`[UI] Suppressed ${email}`);
        res.redirect('/hold');
    });

    // Create server
    app.set('port', port);
    const server = http.createServer(app);

    server.on('error', err => {
        if (err.syscall !== 'listen') throw err;
        const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
        if (err.code === 'EACCES') { log.error('Express', '%s requires elevated privileges', bind); process.exit(1); }
        if (err.code === 'EADDRINUSE') { log.error('Express', '%s is already in use', bind); process.exit(1); }
    });

    server.on('listening', () => {
        const addr = server.address();
        const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
        log.info('Express', 'WWW server listening on %s', bind);
    });

    process.on('uncaughtException', err => log.error('App', err));

    // Start hold/retry workers
    const holdWorker = require('./lib/hold-worker');
    const retryHoldWorker = require('./lib/retry-hold-worker');

    setInterval(() => {
        holdWorker(redis, hold, zonemta);
        retryHoldWorker(redis, hold, zonemta);
    }, zonemtaConfig.WORKER_INTERVAL_MS);

    app.get('/server-ips', (req, res) => {
        try {
            const interfaces = os.networkInterfaces();
            const ips = [];
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        ips.push(iface.address);
                    }
                }
            }
            res.json({ ips });
        } catch (err) {
            console.error('Error fetching IPs:', err);
            res.status(500).json({ error: 'Failed to fetch server IPs' });
        }
    });

    app.get('/config-paths', (req, res) => {
        if (!zonemtaConfig || !zonemtaConfig.zonemtaConfigPath) {
            return res.status(500).json({ error: 'Config paths not loaded' });
        }
        res.json(zonemtaConfig.zonemtaConfigPath);
    });
    // Start server
    logserver(() => server.listen(port, host));
});
