'use strict';
// 1. OTel API MUST be first
const opentelemetry = require('@opentelemetry/api'); 

// 2. Logger second (so it can grab the OTel context)
const logger = require('./lib/logger'); 

// 3. Then standard modules
const express = require('express');
const path = require('path');
const Database = require('./lib/database');

// 4. Then routes
const highscores = require('./routes/highscores');
const user = require('./routes/user');
const loc = require('./routes/location');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/', express.static(path.join(__dirname, 'public')));

// Routes
app.use('/highscores', highscores);
app.use('/user', user);
app.use('/location', loc);

// Error Handling
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.use(function(err, req, res, next) {
    if (res.headersSent) { return next(err); }
    logger.error('Application Error', { message: err.message, status: err.status });
    res.status(err.status || 500);
    res.render('error');
});

// Connect to DB
Database.connect(app).catch(err => {
    logger.error('Initial MongoDB connection failed', { error: err.message });
});

module.exports = app;
