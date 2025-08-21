import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return new Response(JSON.stringify({ 
    message: 'Hello API is working!',
    timestamp: new Date().toISOString(),
    status: 'success'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};