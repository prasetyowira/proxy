# OpenAI API Proxy for Cloudflare Workers

A simple proxy server that forwards requests to api.openai.com, adding your API key from environment variables.

## Features

- Proxies all API requests to OpenAI
- Securely stores your API key as an environment variable
- Handles CORS for browser requests
- Easy to deploy to Cloudflare Workers

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up your OpenAI API key:
   - For development: Copy `.dev.vars.example` to `.dev.vars` and add your API key
   - For production: Set the secret using Wrangler
   ```bash
   wrangler secret put OPENAI_API_KEY
   ```

3. Run locally:
```bash
npm run dev
```

4. Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Usage

Once deployed, you can use the worker to proxy requests to OpenAI. Simply make requests to your Worker URL using the same endpoint paths as the OpenAI API.

Example with curl:
```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Customization

- Edit `wrangler.toml` to change the worker configuration
- Modify `src/index.js` to add custom logic or adjust the proxy behavior
