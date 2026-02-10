'use strict';
const { MongoClient } = require('mongodb');
const config = require('./config');

let _client = null;
let _db = null;

function Database() {
    this.connect = async function(app) {
        if (_db) return _db;
        if (!_client) {
            console.log('Initializing Bullet-Proof Mongo Client:', config.database.url);
            _client = new MongoClient(config.database.url, config.database.options);
        }
        try {
            await _client.connect();
            _db = _client.db(config.database.dbName || 'pacman');
            app.locals.db = _db;
            console.log('Successfully connected to MongoDB');
            return _db;
        } catch (err) {
            console.error('MongoDB connection failed (will retry automatically):', err.message);
            throw err;
        }
    };

    this.getDb = async function(app) {
        if (!_db) return await this.connect(app);
        return _db;
    };
}
module.exports = new Database();
