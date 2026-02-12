'use strict';

const opentelemetry = require('@opentelemetry/api');
const tracer = opentelemetry.trace.getTracer('pacman-tracer');
const logger = require('./lib/logger');

var express = require('express');
var path = require('path');
var Database = require('./lib/database');
var bodyParser = require('body-parser');

// Routes
var highscores = require('./routes/highscores');
var user = require('./routes/user');
var loc = require('./routes/location');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use('/', express.static(path.join(__dirname, 'public')));
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
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    logger.error('Application Error', { message: err.message, status: err.status });
    res.status(err.status || 500);
    res.render('error');
});

// 2. Connect to Database WITHOUT crashing the pod on failure
Database.connect(app).catch(err => {
    logger.error('Initial MongoDB connection failed', { error: err.message });
});

module.exports = app;
