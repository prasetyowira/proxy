/**
 * OpenAI API Proxy Worker
 * 
 * This worker proxies requests to api.openai.com, adding the API key
 * from environment variables.
 */

const OPENAI_API_URL = 'https://api.openai.com';

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
    return await fetch(finalRequest);
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
    
    // Handle the actual request
    const response = await handleRequest(request, env);
    
    // Add CORS headers to the response
    return addCORSHeaders(response);
  }
};

// Handle CORS preflight requests
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// Add CORS headers to responses
function addCORSHeaders(response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
} 