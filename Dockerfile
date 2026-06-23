FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --network-timeout 300000

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm start"]