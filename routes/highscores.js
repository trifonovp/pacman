var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');
const opentelemetry = require('@opentelemetry/api');

const tracer = opentelemetry.trace.getTracer('pacman-highscores');
var urlencodedParser = bodyParser.urlencoded({ extended: false });

router.post('/', urlencodedParser, async function(req, res) {
    // Manual span for Splunk APM
    const span = tracer.startSpan('mongodb.insert', {
        kind: opentelemetry.SpanKind.CLIENT,
        attributes: { 'db.system': 'mongodb', 'db.name': 'pacman', 'db.operation': 'insert' }
    });

    try {
        const db = await Database.getDb(req.app);
        
        // Save the metadata passed from the frontend
        await db.collection('highscore').insertOne({
            name: req.body.name,
            score: parseInt(req.body.score, 10),
            cloud: req.body.cloud || 'unknown',
            zone: req.body.zone || 'unknown',
            host: req.body.host || 'unknown',
            date: new Date()
        });

        span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
        res.json({ rs: 'success' });
    } catch (err) {
        span.recordException(err);
        span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: err.message });
        span.setAttribute('pacman.highscore.error', 'database_connection_failure');
        res.status(500).json({ rs: 'error' });
    } finally {
        span.end();
    }
});

router.get('/list', async (req, res) => {
    try {
        const db = await Database.getDb(req.app);
        const docs = await db.collection('highscore').find({}).sort({ score: -1 }).limit(10).toArray();
        
        // Ensure metadata fields are included in the response for image_02baa2.jpg
        const result = docs.map(item => ({
            name: item.name,
            score: item.score,
            cloud: item.cloud || 'unknown',
            zone: item.zone || 'unknown',
            host: item.host || 'unknown'
        }));
        
        res.json(result);
    } catch (e) { 
        res.json([]); 
    }
});

module.exports = router;
