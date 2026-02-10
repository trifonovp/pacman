var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');
const opentelemetry = require('@opentelemetry/api');

const tracer = opentelemetry.trace.getTracer('pacman-highscores');
var urlencodedParser = bodyParser.urlencoded({ extended: false });

router.get('/list', urlencodedParser, async function(req, res, next) {
    try {
        const db = await Database.getDb(req.app);
        const docs = await db.collection('highscore').find({}).sort({ score: -1 }).limit(10).toArray();
        res.json(docs);
    } catch (err) {
        console.error('Failed to retrieve list:', err.message);
        res.status(500).json([]);
    }
});

router.post('/', urlencodedParser, async function(req, res, next) {
    console.log('[POST /highscores] Incoming request for:', req.body.name);

    // Manual span creation to force the relationship in Splunk APM
    const span = tracer.startSpan('mongodb.insert', {
        kind: opentelemetry.SpanKind.CLIENT,
        attributes: {
            'db.system': 'mongodb',
            'db.name': 'pacman',
            'db.operation': 'insert',
            'db.statement': JSON.stringify({ name: req.body.name, score: req.body.score })
        }
    });

    try {
        const db = await Database.getDb(req.app);
        await db.collection('highscore').insertOne({
            name: req.body.name,
            score: parseInt(req.body.score, 10),
            date: new Date()
        }, { w: 1 });

        span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
        res.json({ rs: 'success' });

    } catch (err) {
        console.error('Failed to save highscore:', err.message);

        // Record the error for your Splunk Detector
        span.recordException(err);
        span.setStatus({ 
            code: opentelemetry.SpanStatusCode.ERROR, 
            message: `Custom DB Error: ${err.message}` 
        });
        
        span.setAttribute('error', true);
        span.setAttribute('sf_error', true); // Indexed for SignalFlow
        span.setAttribute('pacman.highscore.error', 'database_connection_failure');

        res.status(500).json({ rs: 'error', message: err.message });
    } finally {
        span.end(); // Finalize and send to Splunk
    }
});

module.exports = router;
