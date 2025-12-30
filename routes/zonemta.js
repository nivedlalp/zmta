'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const config = require('../config/zonemta');

function ensureConfig() {
    if (!config || !Array.isArray(config.zonemtaConfigPath)) {
        throw new Error('zonemtaConfigPath not configured');
    }
}

function resolveSectionDir(section) {
    ensureConfig();

    const [mainPath, interfacesPath, zonesPath] = config.zonemtaConfigPath;

    switch (section) {
        case 'pools':
            return mainPath;
        case 'zones':
            return zonesPath;
        case 'interfaces':
            return interfacesPath;
        default:
            throw new Error('Unknown section');
    }
}

function resolveFilePath(section, name) {
    ensureConfig();

    if (!name) throw new Error('Filename required');

    const dir = resolveSectionDir(section);

    if (section === 'pools') {
        return path.join(dir, 'pools.toml');
    }

    return path.join(dir, `${name}.toml`);
}

router.get('/:section', (req, res) => {
    try {
        const dir = resolveSectionDir(req.params.section);

        fs.readdir(dir, (err, files) => {
            if (err) return res.status(500).send(err.message);
            res.json(files.filter(f => f.endsWith('.toml')));
        });
    } catch (e) {
        res.status(400).send(e.message);
    }
});

router.get('/:section/:name', (req, res) => {
    try {
        const filePath = resolveFilePath(req.params.section, req.params.name);

        if (!fs.existsSync(filePath)) {
            return res.status(404).send('File not found');
        }

        res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        res.status(400).send(e.message);
    }
});

router.post('/:section/:name', express.json(), (req, res) => {
    try {
        const filePath = resolveFilePath(req.params.section, req.params.name);

        if (fs.existsSync(filePath)) {
            return res.status(409).send('File already exists');
        }

        if (!req.body || typeof req.body.content !== 'string') {
            return res.status(400).send('Missing content');
        }

        fs.writeFileSync(filePath, req.body.content, 'utf8');
        res.sendStatus(201);
    } catch (e) {
        res.status(400).send(e.message);
    }
});

router.put('/:section/:name', express.json(), (req, res) => {
    try {
        const filePath = resolveFilePath(req.params.section, req.params.name);

        if (!fs.existsSync(filePath)) {
            return res.status(404).send('File does not exist');
        }

        if (!req.body || typeof req.body.content !== 'string') {
            return res.status(400).send('Missing content');
        }

        fs.writeFileSync(filePath, req.body.content, 'utf8');
        res.sendStatus(200);
    } catch (e) {
        res.status(400).send(e.message);
    }
});

router.delete('/:section/:name', (req, res) => {
    try {
        const filePath = resolveFilePath(req.params.section, req.params.name);

        if (!fs.existsSync(filePath)) {
            return res.status(404).send('File does not exist');
        }

        fs.unlinkSync(filePath);
        res.sendStatus(204);
    } catch (e) {
        res.status(400).send(e.message);
    }
});

module.exports = router;
