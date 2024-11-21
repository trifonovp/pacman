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
RUN npm install --save @opentelemetry/api
RUN npm install --save @splunk/otel-web
RUN npm install --save @splunk/otel-web-session-recorder


# Set appropriate permissions
RUN chmod -R go+r /usr/src/app/node_modules/@splunk/otel
RUN chmod -R go+r /usr/src/app/node_modules/@opentelemetry/api
RUN chmod -R go+r /usr/src/app/node_modules/@splunk/otel-web
RUN chmod -R go+r /usr/src/app/node_modules/@splunk/otel-web-session-recorder

# Expose port 8080
EXPOSE 8080

# Run container
CMD ["npm", "start"]
