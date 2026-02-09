var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');

const opentelemetry = require('@opentelemetry/api');
// Initialize the tracer
const tracer = opentelemetry.trace.getTracer('pacman-highscores');

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
    console.log('Time: ', Date());
    next();
})

router.get('/list', urlencodedParser, function(req, res, next) {
    console.log('[GET /highscores/list]');
    
    // Start a span for the GET operation
    const span = tracer.startSpan('getHighscores', { kind: opentelemetry.SpanKind.CLIENT });

    Database.getDb(req.app, function(err, db) {
        if (err) {
            span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: err.message });
            span.end();
            return next(err);
        }

        // Retrieve the top 10 high scores
        var col = db.collection('highscore');
        col.find({}).sort([['score', -1]]).limit(10).toArray(function(err, docs) {
            var result = [];
            if (err) {
                console.log(err);
                span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: err.message });
            } else {
                docs.forEach(function(item, index, array) {
                    result.push({ 
                        name: item['name'], 
                        cloud: item['cloud'],
                        zone: item['zone'], 
                        host: item['host'],
                        score: item['score'] 
                    });
                });
                span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
            }

            // End the span before sending the response
            span.end();
            res.json(result);
        });
    });
});

// Accessed at /highscores
router.post('/', urlencodedParser, function(req, res, next) {
    console.log('[POST /highscores] body =', req.body,
                ' host =', req.headers.host,
                ' user-agent =', req.headers['user-agent'],
                ' referer =', req.headers.referer);

    // Start a span for the POST/Insert operation
    const span = tracer.startSpan('saveHighscore', { kind: opentelemetry.SpanKind.CLIENT });
    span.setAttribute('db.system', 'mongodb');
    span.setAttribute('db.name', 'pacmandb');

    var userScore = parseInt(req.body.score, 10),
        userLevel = parseInt(req.body.level, 10);

    Database.getDb(req.app, function(err, db) {
        if (err) {
            console.log('Failed to connect to DB for /highscores');
            span.setAttribute('pacman_custom_message', 'Failed to connect to database');
            span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: err.message });
            span.end(); // Span must end here if we return early
            return next(err);
        }

        // Insert high score with extra user data
        db.collection('highscore').insertOne({
                name: req.body.name,
                cloud: req.body.cloud,
                zone: req.body.zone,
                host: req.body.host,
                score: userScore,
                level: userLevel,
                date: new Date(),
                referer: req.headers.referer,
                user_agent: req.headers['user-agent'],
                hostname: req.hostname,
                ip_addr: req.ip
            }, {
                // FIXED: Changed 'majority' to 1 for single-node standalone MongoDB
                w: 1, 
                j: true,
                wtimeout: 10000
            }, function(err, result) {
                var returnStatus = '';

                if (err) {
                    console.log('Database Insert Error:', err);
                    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: err.message });
                    returnStatus = 'error';
                } else {
                    console.log('Successfully inserted highscore');
                    span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
                    returnStatus = 'success';
                }

                // Finalize the span so it exports to Splunk APM
                span.end();

                res.json({
                    name: req.body.name,
                    zone: req.body.zone,
                    score: userScore,
                    level: userLevel,
                    rs: returnStatus
                });
            });
    });
});

module.exports = router;
