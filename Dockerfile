FROM node:12.13.0-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
# COPY package.json package*.json ./

# Copy local code to the container image.
COPY . ./

# Install the NPM deps
RUN npm install

# Build the Typescript files
RUN npm run build

# Remove devDepedencies
RUN npm prune --production

EXPOSE 8080

CMD ["npm", "start"]
