var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');
const opentelemetry = require('@opentelemetry/api');

// Initialize the tracer for manual instrumentation if needed
const tracer = opentelemetry.trace.getTracer('pacman-highscores');

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
    console.log('Time: ', new Date().toISOString());
    next();
})

/**
 * GET /highscores/list
 * Retrieves the top 10 scores from MongoDB.
 * Modernized to use async/await to match our new database logic.
 */
router.get('/list', urlencodedParser, async function(req, res, next) {
    console.log('[GET /highscores/list] Fetching top scores...');
    
    try {
        // Correctly await the Promise-based database connection
        const db = await Database.getDb(req.app);
        
        // Execute the query and await the result array
        const docs = await db.collection('highscore')
                             .find({})
                             .sort({ score: -1 })
                             .limit(10)
                             .toArray();

        // Map the MongoDB documents to the format the frontend expects
        const result = docs.map(item => ({
            name: item.name,
            cloud: item.cloud || 'unknown',
            zone: item.zone || 'unknown',
            host: item.host || 'unknown',
            score: item.score
        }));

        console.log(`Successfully retrieved ${result.length} scores.`);
        res.json(result);

    } catch (err) {
        console.error('Failed to retrieve highscores:', err.message);
        // Return an empty array so the UI table doesn't stay empty/spinning
        res.status(500).json([]);
    }
});

/**
 * POST /highscores
 * Saves a new high score to MongoDB.
 */
router.post('/', urlencodedParser, async function(req, res, next) {
    console.log('[POST /highscores] Incoming request for:', req.body.name, 'Score:', req.body.score);

    // 1. Create a manual span to wrap the DB operation
    const span = tracer.startSpan('mongodb.insert', {
        kind: opentelemetry.SpanKind.CLIENT,
        attributes: {
            'db.system': 'mongodb',
            'db.name': 'pacman',
            'db.mongodb.collection': 'highscore',
            'db.operation': 'insert',
            'db.statement': JSON.stringify({ name: req.body.name, score: req.body.score })
        }
    });

    try {
        const db = await Database.getDb(req.app);

        // 2. Perform the database operation
        const result = await db.collection('highscore').insertOne({
            name: req.body.name,
            score: parseInt(req.body.score, 10),
            date: new Date(),
            host: req.body.host
        }, { w: 1 });

        console.log('Highscore saved successfully for:', req.body.name);

        // Mark span as successful
        span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
        res.json({ rs: 'success', name: req.body.name });

    } catch (err) {
        console.error('Failed to save highscore:', err.message);

        // 3. Manually record the error on the span
        span.recordException(err);
        span.setStatus({
            code: opentelemetry.SpanStatusCode.ERROR,
            message: `Custom DB Error: ${err.message}`
        });

        // Add custom attributes for your Detector
        span.setAttribute('error', true);
        span.setAttribute('sf_error', true);
        span.setAttribute('pacman.highscore.error', 'database_connection_failure');

        res.status(500).json({
            rs: 'error',
            message: err.message
        });
    } finally {
        // 4. Always end the span to flush it to Splunk APM
        span.end();
    }
});
