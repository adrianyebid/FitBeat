FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the TypeScript files
RUN npm run build

EXPOSE 8082

CMD ["npm", "start"]
