'use strict';

const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

router.post('/', (req, res) => {
    exec('systemctl restart zonemta', err => {
        if (err) return res.status(500).send(err.message);
        res.send('ZoneMTA restarted');
    });
});

module.exports = router;
