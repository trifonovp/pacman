// Start Splunk OTel at the absolute beginning
const { start } = require('@splunk/otel');

const opentelemetry = require('@opentelemetry/api');
const tracer = opentelemetry.trace.getTracer('pacman-tracer');

'use strict';

var express = require('express');
var path = require('path');
var Database = require('./lib/database');
var assert = require('assert');

// Routes
var highscores = require('./routes/highscores');
var user = require('./routes/user');
var loc = require('./routes/location');

var app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Static files
app.use('/', express.static(path.join(__dirname, 'public')));

// Mount routers
app.use('/highscores', highscores);
app.use('/user', user);
app.use('/location', loc);

// Catch 404
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Error Handler
app.use(function(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('error');
});

Database.connect(app, function(err) {
    if (err) {
        console.error('Initial DB connection failed. Application will retry on first request.');
    } else {
        console.log('Database initialized on startup.');
    }
});

module.exports = app;
