var http = require('http');
var https = require('https');
var express = require('express');
var router = express.Router();
var fs = require('fs');
var os = require('os');

// Helper to export metadata for other routes
router.getMetadata = async function() {
    let cloud = process.env.CLOUD_PROVIDER || 'unknown';
    let zone = process.env.CLOUD_ZONE || 'unknown';
    const host = os.hostname();

    try {
        const k8s = await getK8sMetadata();
        if (k8s.cloud !== 'unknown') cloud = k8s.cloud;
        if (k8s.zone !== 'unknown') zone = k8s.zone;
    } catch (e) {
        console.log('K8s API check skipped, using fallbacks');
    }
    return { cloud, zone, host };
};

router.get('/metadata', async function(req, res) {
    const meta = await router.getMetadata();
    res.json(meta);
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
            timeout: 2000
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
