'use strict';

const MongoClient = require('mongodb').MongoClient;
const config = require('./config');
const opentelemetry = require('@opentelemetry/api');

let _db = null;
let _connecting = false; // Prevents the connection loop

function Database() {
    this.connect = function(app, callback) {
        if (_db) return callback(null, _db);
        if (_connecting) return; // Already trying, don't spam

        _connecting = true;
        console.log('Connecting to MongoDB:', config.database.url);
        
        MongoClient.connect(config.database.url, config.database.options, function (err, client) {
            _connecting = false;
            const activeSpan = opentelemetry.trace.getSpan(opentelemetry.context.active());
            
            if (err) {
                console.error('DATABASE CONNECTION ERROR:', err.message);
                if (activeSpan) activeSpan.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: err.message });
                return callback(err);
            }

            // Correctly extract the DB object using the dbName from your config
            _db = client.db(config.database.dbName);
            app.locals.db = _db;
            
            console.log('Successfully connected to MongoDB database:', config.database.dbName);
            if (activeSpan) activeSpan.setStatus({ code: opentelemetry.SpanStatusCode.OK });
            
            callback(null, _db);
        });
    };

    this.getDb = function(app, callback) {
        if (!_db) {
            this.connect(app, callback);
        } else {
            callback(null, _db);
        }
    };
}

module.exports = exports = new Database();
