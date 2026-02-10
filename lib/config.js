var service_host = 'localhost';
var auth_details = '';
var mongo_database = 'pacman';
var mongo_port = '27017';
var use_ssl = false;
var validate_ssl = true;
var connection_details = '';

if(process.env.MONGO_SERVICE_HOST) {
    service_host = process.env.MONGO_SERVICE_HOST;
}

if(process.env.MONGO_DATABASE) {
    mongo_database = process.env.MONGO_DATABASE;
}

if(process.env.MY_MONGO_PORT) {
    mongo_port = process.env.MY_MONGO_PORT;
}

// ... (keep your SSL and Auth logic as is) ...

var hosts = service_host.split(',');
for (let i=0; i<hosts.length;i++) {
  connection_details += `${hosts[i]}:${mongo_port},`;
}
connection_details = connection_details.replace(/,\s*$/, "");

var database = {
    url: `mongodb://${auth_details}${connection_details}/${mongo_database}`,
    dbName: mongo_database,
    options: {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000, // Reduced from 30s to 5s for fast error reporting
        socketTimeoutMS: 30000,
        family: 4 // Force IPv4 to bypass potential K8s DNS resolution issues
    }
};

exports.database = database;
