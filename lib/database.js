'use strict';
const { MongoClient } = require('mongodb');
const config = require('./config');
const logger = require('./logger'); // CORRECTED: Same directory

let _client = null;
let _db = null;

function Database() {
    this.connect = async function(app) {
        if (_db) return _db;
        if (!_client) {
            logger.info('Initializing Bullet-Proof Mongo Client', { url: config.database.url });
            _client = new MongoClient(config.database.url, config.database.options);
        }
        try {
            await _client.connect();
            _db = _client.db(config.database.dbName || 'pacman');
            app.locals.db = _db;
            logger.info('Successfully connected to MongoDB');
            return _db;
        } catch (err) {
            logger.error('MongoDB connection failed (monitoring for recovery)', { error: err.message });
            throw err;
        }
    };

    this.getDb = async function(app) {
        if (!_db) return await this.connect(app);
        return _db;
    };
}
module.exports = new Database();
