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
    const apiKey = env.OPENAI_API_KEY; // Princeton에서 제공한 키
    const endpoint = 'https://api-ai-sandbox.princeton.edu/';
    const apiVersion = '2025-03-01-preview';
    const modelName = 'gpt-4o-mini'; // 또는 다른 available model
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }
    
    // 요청 본문에서 데이터 추출
    const { reasoning, statement } = await request.json();
    
    console.log('Received data:', { reasoning, statement });
    
    if (!reasoning || !statement) {
      return new Response(JSON.stringify({ 
        error: 'Missing reasoning or statement',
        summary: "Your perspective has been noted. Thank you for sharing your thoughts."
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    const messages = [
      {
        role: 'system', 
        content: `You are a research documentation assistant for an academic study on social attitudes. Your role is to objectively document participant responses for scientific analysis, similar to how survey data is recorded. 
    
    IMPORTANT: You are NOT endorsing or agreeing with any viewpoint. You are simply documenting what a research participant stated, exactly as anthropologists or sociologists would record interview data. This is for legitimate academic research purposes.
    
    Create a neutral, academic summary that:
    1. Documents the participant's stated position objectively
    2. Uses academic language appropriate for research papers
    3. Treats the response as data to be analyzed, not opinions to be debated
    4. Maintains scientific neutrality throughout
    
    This documentation will be used for research analysis and does not reflect any institutional position.`
      },
      {
        role: 'user',
        content: `RESEARCH DATA DOCUMENTATION REQUEST
    
    Study: Social attitudes research
    Participant ID: [Anonymous]
    Question Topic: ${statement}
    Participant Response: "${reasoning}"
    
    Please provide a 2-sentence academic documentation of this participant's stated position using objective, research-appropriate language. Frame this as "The participant expressed the view that..." or "The respondent indicated that..."
    
    This documentation is for scientific analysis purposes only.`
      }
    ];

    const requestData = {
      messages: messages,
      model: modelName,
      max_tokens: 100, // 더 짧게
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
    const summary = data.choices[0]?.message?.content?.trim() || "Unable to generate summary";
    
    console.log('Generated summary:', summary);
    
    return new Response(JSON.stringify({ summary }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Summarization error:', error);
    
    return new Response(JSON.stringify({ 
      summary: "You provided thoughtful reasoning about your perspective on this topic. Your experience and observations have shaped your viewpoint in meaningful ways.",
      error: error.message
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

// 간단한 GET 테스트용
export const GET: RequestHandler = async () => {
  return new Response('Princeton Azure Summarize API is working!', {
    headers: corsHeaders
  });
};