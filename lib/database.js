'use strict';

const { MongoClient } = require('mongodb');
const config = require('./config');

let _client = null;
let _db = null;

function Database() {
    this.connect = async function(app) {
        // If we already have a functional DB object, return it
        if (_db) return _db;

        // Initialize the client ONLY ONCE to enable internal reconnection logic
        if (!_client) {
            console.log('Initializing persistent MongoDB Client:', config.database.url);
            _client = new MongoClient(config.database.url, config.database.options);
        }

        try {
            // Modern connect() is idempotent and triggers background topology monitoring
            await _client.connect();
            _db = _client.db(config.database.dbName || 'pacman');
            
            // Share the DB object with the Express app
            app.locals.db = _db;
            
            console.log('Successfully connected to MongoDB');
            return _db;
        } catch (err) {
            // We do NOT destroy the client on failure. We want it to stay alive
            // so it can automatically reconnect when the Mongo pod returns.
            console.error('MongoDB connection attempt failed:', err.message);
            throw err;
        }
    };

    this.getDb = async function(app) {
        // If _db isn't set (e.g., initial failure), try to connect
        if (!_db) {
            return await this.connect(app);
        }
        
        // If _db exists but connection is temporarily lost, the driver 
        // will automatically buffer and retry operations internally.
        return _db;
    };
}

module.exports = new Database();
