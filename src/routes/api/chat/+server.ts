import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// OPTIONS 요청 처리 (CORS preflight)
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Princeton Azure OpenAI 설정
    const apiKey = env.OPENAI_API_KEY;
    const endpoint = 'https://api-ai-sandbox.princeton.edu/';
    const apiVersion = '2025-03-01-preview';
    const modelName = 'gpt-4o-mini';
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }
    
    // 요청 본문에서 데이터 추출
    const { messages } = await request.json();
    
    console.log('Received chat request:', { messageCount: messages?.length });
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid messages format'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 기본 챗봇 시스템 프롬프트
    const systemPrompt = "You are a helpful AI assistant. Respond naturally and helpfully to user questions.";
    
    // 대화 컨텍스트 구성
    const conversationMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages
    ];

    const requestData = {
      messages: conversationMessages,
      model: modelName,
      max_tokens: 300,
      temperature: 0.7
    };

    console.log('Making Princeton Azure OpenAI API call');
    
    // Princeton Azure OpenAI API 호출
    const apiUrl = `${endpoint}openai/deployments/${modelName}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    console.log('API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Princeton Azure OpenAI API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content?.trim() || "I'm here to help! How can I assist you?";
    
    console.log('Generated AI response length:', aiMessage.length);
    
    return new Response(JSON.stringify({ 
      message: aiMessage
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    
    return new Response(JSON.stringify({ 
      message: "I'm sorry, I'm having trouble processing your request right now. Please try again.",
      error: error.message
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

// GET 테스트용
export const GET: RequestHandler = async () => {
  return new Response('Chat API is working!', {
    headers: corsHeaders
  });
};