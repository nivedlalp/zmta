'use strict';

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('zonemta');
});

module.exports = router;
