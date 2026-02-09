var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');
const opentelemetry = require('@opentelemetry/api');

var urlencodedParser = bodyParser.urlencoded({ extended: false });

router.post('/', urlencodedParser, function(req, res, next) {
    const activeSpan = opentelemetry.trace.getSpan(opentelemetry.context.active());
    
    Database.getDb(req.app, function(err, db) {
        if (err) {
            console.error('[POST /highscores] DB Connection Failed');
            if (activeSpan) {
                activeSpan.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: err.message });
                activeSpan.setAttribute('error', true);
            }
            return res.status(500).json({ rs: 'error', message: 'No DB connection' });
        }

        db.collection('highscore').insertOne({
            name: req.body.name,
            score: parseInt(req.body.score, 10),
            date: new Date(),
            host: req.body.host
        }, {
            w: 1, // Reliable for single-node K8s
            wtimeout: 5000 
        }, function(err, result) {
            if (err) {
                console.error('[POST /highscores] Insert Failed:', err.message);
                if (activeSpan) {
                    activeSpan.recordException(err);
                    activeSpan.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
                }
                return res.json({ rs: 'error' });
            }

            console.log('Score saved successfully for:', req.body.name);
            if (activeSpan) activeSpan.setStatus({ code: opentelemetry.SpanStatusCode.OK });
            
            res.json({ rs: 'success', name: req.body.name });
        });
    });
});

module.exports = router;
