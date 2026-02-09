var http = require('http');
var https = require('https');
var express = require('express');
var router = express.Router();
var fs = require('fs');
var os = require('os');

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date());
    next();
})

router.get('/metadata', function(req, res, next) {
    console.log('[GET /loc/metadata]');
    var h = getHost();
    getCloudMetadata(function(c, z) {
        console.log(`CLOUD: ${c}`);
        console.log(`ZONE: ${z}`);
        console.log(`HOST: ${h}`);
        res.json({
            cloud: c,
            zone: z,
            host: h
        });
    });
});

function getCloudMetadata(callback) {
    console.log('getCloudMetadata');
    // Query k8s node api
    getK8sCloudMetadata(function(err, c, z) {
        // If we successfully talked to K8s, we STOP even if cloud is "unknown"
        if (err) {
            console.log('K8s API failed, trying fallbacks...');
            // Try AWS next
            getAWSCloudMetadata(function(err, c, z) {
                if (err) {
                    getAzureCloudMetadata(function(err, c, z) {
                        if (err) {
                            getGCPCloudMetadata(function(err, c, z) {
                                if (err) {
                                    getOpenStackCloudMetadata(function(err, c, z) {
                                        callback(c, z);
                                    });
                                } else { callback(c, z); }
                            });
                        } else { callback(c, z); }
                    });
                } else { callback(c, z); }
            });
        } else {
            callback(c, z); // Success in K8s, stop here.
        }
    });
}

function getOpenStackCloudMetadata(callback) {
    console.log('getOpenStackCloudMetadata');
    var osOptions = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/openstack/latest/meta_data.json',
        method: 'GET',
        timeout: 2000, // Reduced timeout for faster failure
    };

    var cloudName = 'unknown', zone = 'unknown';
    var req = http.request(osOptions, (metadataRes) => {
        if (metadataRes.statusCode !== 200) {
            metadataRes.resume();
            callback(new Error('Not OpenStack'), cloudName, zone);
            return;
        }
        metadataRes.setEncoding('utf8');
        metadataRes.on('data', (chunk) => {
            var metaData = JSON.parse(chunk);
            zone = metaData.availability_zone;
            cloudName = 'OpenStack';
        });
        metadataRes.on('end', () => { callback(null, cloudName, zone); });
    });
    req.on('error', (e) => { callback(e, cloudName, zone); });
    req.end();
}

function getAWSCloudMetadata(callback) {
    console.log('getAWSCloudMetadata');
    var awsOptions = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/latest/meta-data/placement/availability-zone',
        method: 'GET',
        timeout: 2000,
    };

    var cloudName = 'unknown', zone = 'unknown';
    var req = http.request(awsOptions, (zoneRes) => {
        if (zoneRes.statusCode !== 200) {
            zoneRes.resume();
            callback(new Error('Not AWS'), cloudName, zone);
            return;
        }
        zoneRes.setEncoding('utf8');
        zoneRes.on('data', (chunk) => { zone = chunk; cloudName = 'AWS'; });
        zoneRes.on('end', () => { callback(null, cloudName, zone); });
    });
    req.on('error', (e) => { callback(e, cloudName, zone); });
    req.end();
}

function getAzureCloudMetadata(callback) {
    console.log('getAzureCloudMetadata');
    var azureOptions = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/metadata/instance/compute/location?api-version=2017-04-02&format=text',
        method: 'GET',
        timeout: 2000,
        headers: { 'Metadata': 'true' }
    };

    var cloudName = 'unknown', zone = 'unknown';
    var req = http.request(azureOptions, (zoneRes) => {
        if (zoneRes.statusCode !== 200) {
            zoneRes.resume();
            callback(new Error('Not Azure'), cloudName, zone);
            return;
        }
        zoneRes.setEncoding('utf8');
        zoneRes.on('data', (chunk) => { zone = chunk; cloudName = 'Azure'; });
        zoneRes.on('end', () => { callback(null, cloudName, zone); });
    });
    req.on('error', (e) => { callback(e, cloudName, zone); });
    req.end();
}

function getGCPCloudMetadata(callback) {
    console.log('getGCPCloudMetadata');
    var gcpOptions = {
        hostname: 'metadata.google.internal',
        port: 80,
        path: '/computeMetadata/v1/instance/zone',
        method: 'GET',
        timeout: 2000,
        headers: { 'Metadata-Flavor': 'Google' }
    };

    var cloudName = 'unknown', zone = 'unknown';
    var req = http.request(gcpOptions, (zoneRes) => {
        if (zoneRes.statusCode !== 200) {
            zoneRes.resume();
            callback(new Error('Not GCP'), cloudName, zone);
            return;
        }
        zoneRes.setEncoding('utf8');
        zoneRes.on('data', (chunk) => { zone = chunk; cloudName = 'GCP'; });
        zoneRes.on('end', () => { callback(null, cloudName, zone); });
    });
    req.on('error', (e) => { callback(e, cloudName, zone); });
    req.end();
}

function getK8sCloudMetadata(callback) {
    console.log('getK8sCloudMetadata');
    var node_name = process.env.MY_NODE_NAME;
    console.log('Querying ' + node_name + ' for cloud data');

    var sa_token, ca_file;
    try {
        sa_token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
        ca_file = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
    } catch (err) {
        console.log('Failed to read K8s secrets:', err.message);
        return callback(err, 'unknown', 'unknown');
    }

    var genericOptions = {
        host: 'kubernetes.default.svc',
        port: 443,
        path: `/api/v1/nodes/${node_name}`,
        timeout: 5000,
        ca: ca_file,
        headers: { 'Authorization': `Bearer ${sa_token}` },
    };

    var cloudName = 'unknown', zone = 'unknown';

    var req = https.request(genericOptions, (zoneRes) => {
        if (zoneRes.statusCode !== 200) {
            zoneRes.resume();
            return callback(new Error(`K8s API status: ${zoneRes.statusCode}`), cloudName, zone);
        }

        var body = [];
        zoneRes.on('data', (chunk) => { body.push(chunk); });
        zoneRes.on('end', () => {
            try {
                var metaData = JSON.parse(body.join(''));
                
                // 1. Identify Cloud Provider
                if (metaData.spec.providerID) {
                    cloudName = metaData.spec.providerID.split(":")[0];
                }

                // 2. Identify Zone (check modern and legacy labels)
                var labels = metaData.metadata.labels;
                zone = labels['topology.kubernetes.io/zone'] || 
                       labels['failure-domain.beta.kubernetes.io/zone'] || 
                       'unknown';

                console.log(`K8s Success - Cloud: ${cloudName}, Zone: ${zone}`);
                callback(null, cloudName, zone); // Returning null error stops the chain
            } catch (e) {
                callback(e, cloudName, zone);
            }
        });
    });

    req.on('error', (e) => { callback(e, cloudName, zone); });
    req.end();
}

function getHost() {
    var host = os.hostname();
    return host;
}

module.exports = router;
