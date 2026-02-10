var http = require('http');
var https = require('https');
var express = require('express');
var router = express.Router();
var fs = require('fs');
var os = require('os');

// Middleware for logging
router.use(function timeLog(req, res, next) {
    console.log('Time: ', new Date().toISOString());
    next();
});

/**
 * GET /loc/metadata
 * Reflected as async to ensure metadata is fetched before response.
 */
router.get('/metadata', async function(req, res, next) {
    console.log('[GET /loc/metadata]');
    
    const host = os.hostname();
    
    try {
        // Await the metadata retrieval process
        const metadata = await getCloudMetadata();
        
        console.log(`Final Result - CLOUD: ${metadata.cloud}, ZONE: ${metadata.zone}, HOST: ${host}`);
        
        res.json({
            cloud: metadata.cloud,
            zone: metadata.zone,
            host: host
        });
    } catch (err) {
        console.error('Metadata route error:', err);
        res.json({ cloud: 'unknown', zone: 'unknown', host: host });
    }
});

/**
 * Orchestrates the fallback chain using Promises.
 */
async function getCloudMetadata() {
    console.log('Starting Cloud Metadata detection chain...');

    // 1. High Priority: Manual Overrides (Useful for Hyper-V/Nested Azure setups)
    if (process.env.CLOUD_PROVIDER && process.env.CLOUD_ZONE) {
        return { cloud: process.env.CLOUD_PROVIDER, zone: process.env.CLOUD_ZONE };
    }

    // 2. Automated Fallback Chain
    try { return await getK8sCloudMetadata(); } catch (e) {}
    try { return await getAzureCloudMetadata(); } catch (e) {}
    try { return await getAWSCloudMetadata(); } catch (e) {}
    try { return await getGCPCloudMetadata(); } catch (e) {}
    try { return await getOpenStackCloudMetadata(); } catch (e) {}

    return { cloud: 'unknown', zone: 'unknown' };
}

/**
 * Helper to wrap http.request in a Promise
 */
function makeRequest(options, providerName) {
    return new Promise((resolve, reject) => {
        const protocol = options.port === 443 ? https : http;
        const req = protocol.request(options, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Not ${providerName}`));
            }
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ body, providerName }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function getK8sCloudMetadata() {
    const nodeName = process.env.MY_NODE_NAME;
    if (!nodeName) throw new Error('MY_NODE_NAME not set');

    const saToken = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
    const caFile = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');

    const options = {
        host: 'kubernetes.default.svc',
        port: 443,
        path: `/api/v1/nodes/${nodeName}`,
        method: 'GET',
        ca: caFile,
        headers: { 'Authorization': `Bearer ${saToken}` },
        timeout: 3000
    };

    const response = await makeRequest(options, 'K8s');
    const data = JSON.parse(response.body);
    
    const cloud = data.spec.providerID ? data.spec.providerID.split(":")[0] : 'unknown';
    const zone = data.metadata.labels['topology.kubernetes.io/zone'] || 
                 data.metadata.labels['failure-domain.beta.kubernetes.io/zone'] || 
                 'unknown';

    return { cloud, zone };
}

async function getAzureCloudMetadata() {
    const options = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/metadata/instance/compute/location?api-version=2017-04-02&format=text',
        method: 'GET',
        headers: { 'Metadata': 'true' },
        timeout: 2000
    };
    const response = await makeRequest(options, 'Azure');
    return { cloud: 'Azure', zone: response.body };
}

async function getAWSCloudMetadata() {
    const options = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/latest/meta-data/placement/availability-zone',
        method: 'GET',
        timeout: 2000
    };
    const response = await makeRequest(options, 'AWS');
    return { cloud: 'AWS', zone: response.body };
}

async function getGCPCloudMetadata() {
    const options = {
        hostname: 'metadata.google.internal',
        port: 80,
        path: '/computeMetadata/v1/instance/zone',
        method: 'GET',
        headers: { 'Metadata-Flavor': 'Google' },
        timeout: 2000
    };
    const response = await makeRequest(options, 'GCP');
    const zone = response.body.split('/').pop();
    return { cloud: 'GCP', zone };
}

async function getOpenStackCloudMetadata() {
    const options = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/openstack/latest/meta_data.json',
        method: 'GET',
        timeout: 2000
    };
    const response = await makeRequest(options, 'OpenStack');
    const data = JSON.parse(response.body);
    return { cloud: 'OpenStack', zone: data.availability_zone };
}

module.exports = router;
