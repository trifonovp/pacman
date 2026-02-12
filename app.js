'use strict';
const express = require('express');
const path = require('path');
const logger = require('./lib/logger');
const opentelemetry = require('@opentelemetry/api');
const Database = require('./lib/database');

// Routes
const highscores = require('./routes/highscores');
const user = require('./routes/user');
const loc = require('./routes/location');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// MIDDLEWARE: Must be defined BEFORE routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/', express.static(path.join(__dirname, 'public')));

// ROUTE MAPPING
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
    if (res.headersSent) { return next(err); }
    
    // Logging application-level errors with Winston
    logger.error('Application Error', { 
        message: err.message, 
        status: err.status,
        stack: err.stack 
    });
    
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: req.app.get('env') === 'development' ? err : {}
    });
});

// Database Connection: Persistent across app lifecycle
Database.connect(app).catch(err => {
    logger.error('Initial MongoDB connection failed', { error: err.message });
});

module.exports = app;
