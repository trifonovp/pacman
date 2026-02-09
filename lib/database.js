'use strict';

const { MongoClient } = require('mongodb');
const config = require('./config');
const opentelemetry = require('@opentelemetry/api');

let _client = null;
let _db = null;

function Database() {
    this.connect = async function(app) {
        if (_db) return _db;

        console.log('Connecting to MongoDB (Promise-based):', config.database.url);
        
        try {
            // In v6+, connect() returns a Promise, NOT a callback
            _client = await MongoClient.connect(config.database.url, config.database.options);
            _db = _client.db(config.database.dbName);
            
            app.locals.db = _db;
            console.log('Successfully connected to MongoDB database:', config.database.dbName);
            return _db;
        } catch (err) {
            console.error('DATABASE CONNECTION ERROR:', err.message);
            throw err; // Let the caller handle the error
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
