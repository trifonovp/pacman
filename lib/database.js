'use strict';

const MongoClient = require('mongodb').MongoClient;
const config = require('./config');
const opentelemetry = require('@opentelemetry/api');
let _db;

function Database() {
    this.connect = function(app, callback) {
        console.log('Attempting to connect to MongoDB at:', config.database.url);
        
        MongoClient.connect(config.database.url, config.database.options, function (err, client) {
            const activeSpan = opentelemetry.trace.getSpan(opentelemetry.context.active());
            
            if (err) {
                console.error('DATABASE CONNECTION ERROR:', err.message);
                if (activeSpan) {
                    activeSpan.recordException(err);
                    activeSpan.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: err.message });
                }
                return callback(err);
            }

            // Extract the database object using the name from config
            _db = client.db(config.database.dbName);
            app.locals.db = _db;
            
            console.log(`Successfully connected to database: ${config.database.dbName}`);
            if (activeSpan) {
                activeSpan.setAttribute('db.name', config.database.dbName);
                activeSpan.setStatus({ code: opentelemetry.SpanStatusCode.OK });
            }
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
