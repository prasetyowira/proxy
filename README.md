# OpenAI API Proxy for Cloudflare Workers

A simple proxy server that forwards requests to api.openai.com, adding your API key from environment variables.

## Features

- Proxies all API requests to OpenAI
- Securely stores your API key as an environment variable
- Handles CORS for browser requests
- Supports idempotent requests via `Idempotency-Key` header
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

3. Create KV namespace for idempotency:
```bash
wrangler kv:namespace create "IDEMPOTENCY"
```

4. Update the `wrangler.toml` file with your KV namespace ID (replace the placeholder with the ID returned by the command above).

5. Run locally:
```bash
npm run dev
```

6. Deploy to Cloudflare Workers:
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

### Using Idempotency

To make idempotent requests, include the `Idempotency-Key` header with a unique identifier. The proxy will cache the response for 24 hours and return the same response for subsequent requests with the same key.

```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-request-id-123" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Customization

- Edit `wrangler.toml` to change the worker configuration
- Modify `src/index.js` to add custom logic or adjust the proxy behavior
- Adjust the `IDEMPOTENCY_EXPIRATION` constant in `src/index.js` to change how long idempotent responses are cached
