FROM mcr.microsoft.com/playwright:v1.62.1-noble
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY collect.js dom.js server.js validation.js ./
USER pwuser
ENV PORT=8787 BIND_HOST=0.0.0.0
EXPOSE 8787
CMD ["node", "server.js"]
