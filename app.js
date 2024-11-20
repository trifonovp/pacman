const opentelemetry = require('@opentelemetry/api');
const tracer = opentelemetry.trace.getTracer('my-tracer');
const { start } = require('@splunk/otel');

start({
   serviceName: 'pacman',
   endpoint: 'http://localhost:4317',
   metrics: { runtimeMetricsEnabled: true },
   profiling: { memoryProfilingEnabled: true }
});

// Rest of your main module

'use strict';

var express = require('express');
var path = require('path');
var Database = require('./lib/database');
var assert = require('assert');

// Constants

// Routes
var highscores = require('./routes/highscores');
var user = require('./routes/user');
var loc = require('./routes/location');

// App
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Handle root web server's public directory
app.use('/', express.static(path.join(__dirname, 'public')));

app.use('/highscores', highscores);
app.use('/user', user);
app.use('/location', loc);

// Catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Error Handler
app.use(function(err, req, res, next) {
    if (res.headersSent) {
        return next(err)
    }
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

Database.connect(app, function(err) {
    const span = tracer.startSpan('initConnect',{ 'kind':opentelemetry.SpanKind.CLIENT});
    span.setAttribute('db.system','mongodb');
    span.setAttribute('db.name','pacmandb');
    if (err) {
        console.log('Failed to connect to database server');
        span.setAttribute('custom_error_details', 'Failed to connect to database server');
        span.setAttribute('otel.status_code','error');
        span.setAttribute('error',true);
        span.setAttribute('sf_error',true);
    } else {
        console.log('Connected to database server successfully');
        span.setAttribute('status','success');
        span.setAttribute('custom_error_details', 'Connected to database server successfully');
    }
    span.end();
});

module.exports = app;
