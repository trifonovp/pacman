'use strict';

var MongoClient = require('mongodb').MongoClient;
var config = require('./config');
var _db;

function Database() {
    this.connect = function(app, callback) {
        // Use the connection URL from your environment variables
        MongoClient.connect(config.database.url, config.database.options, function (err, client) {
            if (err) {
                console.error('CRITICAL DB CONNECTION ERROR:', err.message);
                console.log('Attempted URL:', config.database.url);
                callback(err);
            } else {
                // IMPORTANT: Modern drivers return a 'client'. 
                // We must call .db() to get the actual database object.
                _db = client.db(config.database.dbName || 'pacman');
                app.locals.db = _db;
                console.log('Successfully established connection to MongoDB');
                callback(null, _db);
            }
        });
    }

    this.getDb = function(app, callback) {
        if (!_db) {
            console.log('No active DB connection found. Attempting to reconnect...');
            this.connect(app, function(err, db) {
                callback(err, db);
            });
        } else {
            callback(null, _db);
        }
    }
}

module.exports = exports = new Database();
