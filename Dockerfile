FROM node:18-alpine

# Set direktori kerja
WORKDIR /app

# Copy package.json dan package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install -G pm2 && npm install

COPY . .

# Expose port untuk running app nya
EXPOSE 3002

# Start menggunakan pm2
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]