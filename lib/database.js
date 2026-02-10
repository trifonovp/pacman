'use strict';

const { MongoClient } = require('mongodb');
const config = require('./config');
let _db = null;
let _connecting = false;

function Database() {
    this.connect = async function(app) {
        if (_db) return _db;
        if (_connecting) return;

        _connecting = true;
        console.log('Connecting to MongoDB:', config.database.url);
        
        try {
            const client = await MongoClient.connect(config.database.url, config.database.options);
            _db = client.db(config.database.dbName || 'pacman');
            app.locals.db = _db;
            _connecting = false;
            console.log('Successfully connected to MongoDB');
            return _db;
        } catch (err) {
            _connecting = false;
            // Throw so the caller can catch and report to OTel
            throw err;
        }
    };

    this.getDb = async function(app) {
        if (!_db) {
            return await this.connect(app);
        }
        return _db;
    };
}

module.exports = new Database();
