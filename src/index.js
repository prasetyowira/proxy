/**
 * OpenAI API Proxy Worker
 * 
 * This worker proxies requests to api.openai.com, adding the API key
 * from environment variables.
 * Supports idempotency via Idempotency-Key header and KV storage.
 */

const OPENAI_API_URL = 'https://api.openai.com';
const IDEMPOTENCY_EXPIRATION = 24 * 60 * 60; // Cache idempotent responses for 24 hours

async function handleRequest(request, env) {
  // Clone the request to modify it
  const url = new URL(request.url);
  
  // Extract the path to forward to OpenAI (everything after /proxy/)
  const path = url.pathname;
  
  // Create a new URL pointing to the OpenAI API
  const openaiUrl = new URL(path, OPENAI_API_URL);
  
  // Clone the original request
  const openaiRequest = new Request(openaiUrl, request);
  
  // Add the Authorization header with the API key
  openaiRequest.headers.set('Authorization', `Bearer ${env.OPENAI_API_KEY}`);
  
  // Forward query parameters
  url.searchParams.forEach((value, key) => {
    openaiUrl.searchParams.set(key, value);
  });
  
  // Update the request URL with query parameters
  const finalRequest = new Request(openaiUrl, openaiRequest);
  
  try {
    // Forward the request to OpenAI
    const response = await fetch(finalRequest);
    
    // Clone the response so we can read the body for caching
    const clonedResponse = new Response(response.body, response);
    
    return clonedResponse;
  } catch (err) {
    // Handle errors
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * Checks if a request has an idempotency key and handles idempotent responses
 * @param {Request} request - The original request
 * @param {Object} env - Environment variables
 * @returns {Promise<Response|null>} - Returns cached response or null if not found
 */
async function checkIdempotency(request, env) {
  // Only apply idempotency for non-GET, non-HEAD, non-OPTIONS requests
  const nonIdempotentMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!nonIdempotentMethods.includes(request.method)) {
    return null;
  }
  
  // Check if idempotency key is present
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey) {
    return null;
  }
  
  // Check if we have a cached response
  const cachedResponse = await env.IDEMPOTENCY.get(`${request.method}:${request.url}:${idempotencyKey}`, { type: 'json' });
  if (cachedResponse) {
    // Return the cached response
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: new Headers(cachedResponse.headers)
    });
  }
  
  return null;
}

/**
 * Stores a response in the KV store for idempotency
 * @param {Request} request - The original request
 * @param {Response} response - The response to cache
 * @param {Object} env - Environment variables
 */
async function storeIdempotentResponse(request, response, env) {
  // Only store responses for non-GET, non-HEAD, non-OPTIONS requests
  const nonIdempotentMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!nonIdempotentMethods.includes(request.method)) {
    return;
  }
  
  // Check if idempotency key is present
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey) {
    return;
  }
  
  // Clone the response so we can read the body
  const clonedResponse = response.clone();
  
  // Extract response data for storage
  const body = await clonedResponse.text();
  const headers = {};
  for (const [key, value] of clonedResponse.headers.entries()) {
    headers[key] = value;
  }
  
  // Store the response in KV
  const responseData = {
    body: body,
    status: clonedResponse.status,
    statusText: clonedResponse.statusText,
    headers: headers
  };
  
  // Store with expiration time
  await env.IDEMPOTENCY.put(
    `${request.method}:${request.url}:${idempotencyKey}`,
    JSON.stringify(responseData),
    { expirationTtl: IDEMPOTENCY_EXPIRATION }
  );
}

export default {
  async fetch(request, env, ctx) {
    // Check if API key is configured
    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY environment variable is not set' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // CORS preflight request handling
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Add Idempotency-Key to allowed headers for CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Max-Age': '86400'
    };
    
    // Check for idempotent request
    const cachedResponse = await checkIdempotency(request, env);
    if (cachedResponse) {
      // Return cached response with CORS headers
      return addCORSHeaders(cachedResponse, corsHeaders);
    }
    
    // Handle the actual request
    const response = await handleRequest(request, env);
    
    // Store the response for idempotency if needed
    ctx.waitUntil(storeIdempotentResponse(request, response, env));
    
    // Add CORS headers to the response
    return addCORSHeaders(response, corsHeaders);
  }
};

// Handle CORS preflight requests
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// Add CORS headers to responses
function addCORSHeaders(response, corsHeaders = {}) {
  const defaultHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key'
  };
  
  const headers = { ...defaultHeaders, ...corsHeaders };
  const newHeaders = new Headers(response.headers);
  
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
} 