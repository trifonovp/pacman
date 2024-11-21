import SplunkOtelWeb from '@splunk/otel-web';
import SplunkSessionRecorder from '@splunk/otel-web-session-recorder'

SplunkOtelWeb.init({
   realm: "us2",
   rumAccessToken: "H6t8M6YW2E33YG1OMRCFtw",
   applicationName: "pacman",
   deploymentEnvironment: "o11y2lab-local-nova"
});

// This must be called after initializing splunk rum
SplunkSessionRecorder.init({
  realm: "us2",
  rumAccessToken: "H6t8M6YW2E33YG1OMRCFtw"
});
