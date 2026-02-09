var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');
const opentelemetry = require('@opentelemetry/api');

var urlencodedParser = bodyParser.urlencoded({ extended: false });

router.post('/', urlencodedParser, function(req, res, next) {
    console.log('[POST /highscores] Saving score for:', req.body.name);
    const activeSpan = opentelemetry.trace.getSpan(opentelemetry.context.active());

    Database.getDb(req.app, function(err, db) {
        if (err) {
            if (activeSpan) activeSpan.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: 'DB Connection Failed' });
            return res.status(500).json({ rs: 'error', message: err.message });
        }

        db.collection('highscore').insertOne({
            name: req.body.name,
            score: parseInt(req.body.score, 10),
            date: new Date(),
            cloud: req.body.cloud,
            zone: req.body.zone,
            host: req.body.host
        }, {
            w: 1, // Single node acknowledgement
            j: true
        }, function(err, result) {
            if (err) {
                console.error('Insert Error:', err.message);
                if (activeSpan) activeSpan.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
                return res.json({ rs: 'error' });
            }

            console.log('Highscore saved successfully');
            if (activeSpan) {
                activeSpan.setAttribute('db.operation', 'insert');
                activeSpan.setStatus({ code: opentelemetry.SpanStatusCode.OK });
            }
            res.json({ rs: 'success', name: req.body.name });
        });
    });
});

module.exports = router;
