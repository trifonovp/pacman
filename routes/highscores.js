var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');
var loc = require('./location'); // Import local metadata logic

const opentelemetry = require('@opentelemetry/api');
const tracer = opentelemetry.trace.getTracer('pacman-highscores');
const logger = require('./lib/logger');

var urlencodedParser = bodyParser.urlencoded({ extended: false });

router.post('/', urlencodedParser, async function(req, res) {
    const span = tracer.startSpan('mongodb.insert', {
        kind: opentelemetry.SpanKind.CLIENT,
        attributes: { 'db.system': 'mongodb', 'db.name': 'pacman', 'db.operation': 'insert' }
    });

    try {
        const db = await Database.getDb(req.app);
        
        // AUTO-FILL LOGIC: If frontend sends 'unknown', fetch real data from backend
        let cloud = req.body.cloud;
        let zone = req.body.zone;
        let host = req.body.host;

        if (!cloud || cloud === 'unknown' || !zone || zone === 'unknown') {
            const meta = await loc.getMetadata();
            cloud = cloud && cloud !== 'unknown' ? cloud : meta.cloud;
            zone = zone && zone !== 'unknown' ? zone : meta.zone;
            host = host && host !== 'unknown' ? host : meta.host;
        }

        await db.collection('highscore').insertOne({
            name: req.body.name,
            score: parseInt(req.body.score, 10),
            cloud: cloud,
            zone: zone,
            host: host,
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
        res.json(docs);
    } catch (e) { res.json([]); }
});

module.exports = router;
