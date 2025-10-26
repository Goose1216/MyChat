FROM node:22-alpine

WORKDIR /src/frontend

COPY package*.json ./
COPY *.config.* ./
COPY *.json ./

RUN npm install
RUN npm install framer-motion


COPY src ./src
COPY public ./public
COPY index.html ./

