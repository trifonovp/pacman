FROM node:jod

MAINTAINER Ivan Font <ifont@redhat.com>

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Clone game source code
RUN git clone https://github.com/trifonovp/pacman.git .

# Install app dependencies
RUN npm install
RUN npm install --save @splunk/otel
RUN npm install --save @opentelemetry/instrumentation-mongodb
RUN npm install --save @opentelemetry/instrumentation-http
RUN npm install --save @opentelemetry/instrumentation-express
RUN npm install --save @opentelemetry/api

# Set appropriate permissions
RUN chmod -R go+r /usr/src/app/node_modules/@splunk/otel
RUN chmod -R go+r /usr/src/app/node_modules/@opentelemetry/instrumentation-mongodb
RUN chmod -R go+r /usr/src/app/node_modules/@opentelemetry/instrumentation-http
RUN chmod -R go+r /usr/src/app/node_modules/@opentelemetry/instrumentation-express
RUN chmod -R go+r /usr/src/app/node_modules/@opentelemetry/api

# Expose port 8080
EXPOSE 8080

# Run container
CMD ["npm", "run", "start:mdb"]
