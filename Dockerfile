FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "tsx", "src/cli.ts"]

