import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const apiKeyExists = !!process.env.OPENAI_API_KEY;
  
  return new Response(JSON.stringify({ 
    message: 'Test API is working!',
    timestamp: new Date().toISOString(),
    apiKeyExists: apiKeyExists
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};