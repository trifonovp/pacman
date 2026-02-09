var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');
const opentelemetry = require('@opentelemetry/api');

var urlencodedParser = bodyParser.urlencoded({ extended: false });

router.post('/', urlencodedParser, async function(req, res, next) {
    console.log('[POST /highscores] Saving score for:', req.body.name);
    
    try {
        // Await the database connection properly
        const db = await Database.getDb(req.app);
        
        const result = await db.collection('highscore').insertOne({
            name: req.body.name,
            score: parseInt(req.body.score, 10),
            date: new Date(),
            host: req.body.host
        }, { w: 1 }); // Force single-node acknowledgement

        console.log('Highscore saved successfully for:', req.body.name);
        res.json({ rs: 'success', name: req.body.name });
        
    } catch (err) {
        console.error('Failed to save highscore:', err.message);
        res.status(500).json({ rs: 'error', message: err.message });
    }
});

module.exports = router;
