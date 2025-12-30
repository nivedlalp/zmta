'use strict';

const fs = require('fs');
const path = require('path');
const { zonemtaConfigPath } = require('../config/zonemta');

function resolveFile(name) {
    return path.join(zonemtaConfigPath, name);
}

module.exports = {
    list() {
        return fs.readdirSync(zonemtaConfigPath)
            .filter(f => f.endsWith('.js'));
    },

    read(name) {
        return fs.readFileSync(resolveFile(name), 'utf8');
    },

    create(name, content) {
        fs.writeFileSync(resolveFile(name), content || '');
    },

    update(name, content) {
        fs.writeFileSync(resolveFile(name), content);
    },

    remove(name) {
        fs.unlinkSync(resolveFile(name));
    }
};
