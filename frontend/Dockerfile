FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* bun.lockb* ./

RUN if [ -f package-lock.json ]; then npm ci && npm install pdfmake@latest; \
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install && pnpm add pdfmake@latest; \
    elif [ -f bun.lockb ]; then npm install -g bun && bun install && bun add pdfmake@latest; \
    else npm install && npm install pdfmake@latest; \
    fi

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
