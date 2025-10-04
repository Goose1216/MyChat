FROM node:22-alpine

WORKDIR /src/frontend

COPY package*.json ./
COPY *.config.* ./
COPY *.json ./

RUN npm install

COPY src ./src
COPY public ./public
COPY index.html ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]