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
    console.log('[POST /highscores] Incoming request for:', req.body.name, 
                'Score:', req.body.score);

    try {
        const db = await Database.getDb(req.app);
        
        var userScore = parseInt(req.body.score, 10) || 0;
        var userLevel = parseInt(req.body.level, 10) || 1;

        // Insert high score with single-node write concern to avoid hangs
        const result = await db.collection('highscore').insertOne({
                name: req.body.name,
                cloud: req.body.cloud || 'unknown',
                zone: req.body.zone || 'unknown',
                host: req.body.host || 'unknown',
                score: userScore,
                level: userLevel,
                date: new Date(),
                referer: req.headers.referer,
                user_agent: req.headers['user-agent'],
                hostname: req.hostname,
                ip_addr: req.ip
            }, {
                w: 1, // Reliable for single-node setups like yours
                j: true
            });

        console.log('Highscore saved successfully for:', req.body.name);
        
        res.json({
            name: req.body.name,
            score: userScore,
            rs: 'success'
        });

    } catch (err) {
        console.error('Failed to save highscore:', err.message);
        res.status(500).json({ 
            rs: 'error', 
            message: err.message 
        });
    }
});

module.exports = router;
