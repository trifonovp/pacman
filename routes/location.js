var http = require('http');
var https = require('https');
var express = require('express');
var router = express.Router();
var fs = require('fs');
var os = require('os');

router.get('/metadata', async function(req, res) {
    console.log('[GET /loc/metadata]');
    const host = os.hostname();
    
    // Fallback if K8s API call fails
    let cloud = process.env.CLOUD_PROVIDER || 'unknown';
    let zone = process.env.CLOUD_ZONE || 'unknown';

    try {
        const k8s = await getK8sMetadata();
        cloud = k8s.cloud;
        zone = k8s.zone;
    } catch (e) {
        console.log('K8s API unreachable, using env/fallbacks');
    }

    res.json({ cloud, zone, host });
});

function getK8sMetadata() {
    return new Promise((resolve, reject) => {
        const node_name = process.env.MY_NODE_NAME;
        if (!node_name) return reject('No Node Name');

        const sa_token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
        const ca_file = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');

        const options = {
            host: 'kubernetes.default.svc',
            port: 443,
            path: `/api/v1/nodes/${node_name}`,
            method: 'GET',
            ca: ca_file,
            headers: { 'Authorization': `Bearer ${sa_token}` },
            timeout: 3000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject('K8s Error');
                const data = JSON.parse(body);
                resolve({
                    cloud: data.spec.providerID ? data.spec.providerID.split(":")[0] : 'unknown',
                    zone: data.metadata.labels['topology.kubernetes.io/zone'] || 'unknown'
                });
            });
        });
        req.on('error', reject);
        req.end();
    });
}
module.exports = router;
