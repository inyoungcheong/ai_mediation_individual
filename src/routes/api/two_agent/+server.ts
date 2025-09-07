import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
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
    
    // API 키 디버깅 출력
    console.log('🔑 Two Agent API Key Debug:');
    console.log('API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey?.length || 0);
    console.log('API Key preview:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined');
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }
    
    // 요청 본문에서 데이터 추출
    const { messages, sessionData, requestType, conversationState } = await request.json();
    
    console.log('Received two agent request:', { 
      messageCount: messages?.length, 
      sessionDataKeys: Object.keys(sessionData || {}),
      requestType: requestType,
      conversationState: conversationState
    });
    
    // 초기 메시지 요청 처리
    if (requestType === 'initial-message') {
      return await generateInitialMessage(sessionData, apiKey, endpoint, apiVersion, modelName);
    }
    
    // 일반 채팅 메시지 처리 (유저 메시지 후 두 에이전트 응답)
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

    // 대화 상태에 따라 적절한 에이전트 응답 생성
    const currentState = conversationState || 'user_message';
    
    if (currentState === 'user_message') {
      // 유저 메시지 후: 감정적 에이전트 응답
      return await generateEmotionalAgentResponse(messages, sessionData, apiKey, endpoint, apiVersion, modelName);
    } else if (currentState === 'emotional_response') {
      // 감정적 에이전트 응답 후: 지적 에이전트 응답
      return await generateIntelligentAgentResponse(messages, sessionData, apiKey, endpoint, apiVersion, modelName);
    } else {
      return new Response(JSON.stringify({ 
        error: 'Invalid conversation state'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

  } catch (error: any) {
    console.error('Two agent chat error:', error);
    
    return new Response(JSON.stringify({ 
      message: "I appreciate you sharing your thoughts with me. Could you tell me more about what has influenced your perspective on this topic?",
      error: error.message
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

// 초기 메시지 생성 함수
async function generateInitialMessage(sessionData: any, apiKey: string, endpoint: string, apiVersion: string, modelName: string) {
  try {
    const systemPrompt = createInitialMessagePrompt(sessionData);
    
    const requestData = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Please generate the initial message to start the conversation.' }
      ],
      model: modelName,
      max_tokens: 400,
      temperature: 0.8
    };

    console.log('Generating initial message for two agent conversation');
    
    const apiUrl = `${endpoint}openai/deployments/${modelName}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Initial message API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content?.trim() || 
      "Hello! I'm here to have a meaningful conversation with you. I'd love to hear your thoughts and perspectives on various topics.";
    
    console.log('Generated initial message length:', aiMessage.length);
    
    return new Response(JSON.stringify({ 
      message: aiMessage,
      sessionData: sessionData,
      messageType: 'initial-message',
      conversationState: 'user_message'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Initial message generation error:', error);
    
    // 폴백 메시지
    const fallbackMessage = "Hello! I'm excited to have a conversation with you. Please share your thoughts and I'll respond with both emotional understanding and thoughtful analysis.";
    
    return new Response(JSON.stringify({ 
      message: fallbackMessage,
      sessionData: sessionData,
      messageType: 'initial-message',
      conversationState: 'user_message'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// 감정적 에이전트 응답 생성 함수
async function generateEmotionalAgentResponse(messages: any[], sessionData: any, apiKey: string, endpoint: string, apiVersion: string, modelName: string) {
  try {
    const systemPrompt = createEmotionalAgentPrompt(sessionData);
    
    // 대화 컨텍스트 구성
    const conversationMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      // 사용자와 AI 메시지들을 올바른 형식으로 변환
      ...messages
        .filter((msg: any) => msg.content !== 'loading' && msg.sender)
        .map((msg: any) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
    ];

    const requestData = {
      messages: conversationMessages,
      model: modelName,
      max_tokens: 300,
      temperature: 0.9 // 더 창의적이고 감정적인 응답을 위해 높은 temperature
    };

    console.log('Making emotional agent API call');
    
    const apiUrl = `${endpoint}openai/deployments/${modelName}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    console.log('Emotional agent API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Emotional agent API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content?.trim() || "I can really feel what you're going through. That sounds challenging and I want you to know that your feelings are completely valid.";
    
    console.log('Generated emotional agent response length:', aiMessage.length);
    
    return new Response(JSON.stringify({ 
      message: aiMessage,
      sessionData: sessionData,
      messageType: 'emotional-response',
      conversationState: 'emotional_response'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Emotional agent response error:', error);
    
    return new Response(JSON.stringify({ 
      message: "I can sense the depth of what you're sharing. Your perspective really matters to me, and I want to understand more about how this affects you personally.",
      sessionData: sessionData,
      messageType: 'emotional-response',
      conversationState: 'emotional_response'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// 지적 에이전트 응답 생성 함수
async function generateIntelligentAgentResponse(messages: any[], sessionData: any, apiKey: string, endpoint: string, apiVersion: string, modelName: string) {
  try {
    const systemPrompt = createIntelligentAgentPrompt(sessionData);
    
    // 대화 컨텍스트 구성
    const conversationMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      // 사용자와 AI 메시지들을 올바른 형식으로 변환
      ...messages
        .filter((msg: any) => msg.content !== 'loading' && msg.sender)
        .map((msg: any) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
    ];

    const requestData = {
      messages: conversationMessages,
      model: modelName,
      max_tokens: 300,
      temperature: 0.7 // 더 논리적이고 분석적인 응답을 위해 중간 temperature
    };

    console.log('Making intelligent agent API call');
    
    const apiUrl = `${endpoint}openai/deployments/${modelName}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    console.log('Intelligent agent API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Intelligent agent API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content?.trim() || "That's a very thoughtful perspective. Let me analyze this from a logical standpoint and share some insights that might be helpful.";
    
    console.log('Generated intelligent agent response length:', aiMessage.length);
    
    return new Response(JSON.stringify({ 
      message: aiMessage,
      sessionData: sessionData,
      messageType: 'intelligent-response',
      conversationState: 'user_message' // 다음은 유저 메시지를 기다림
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Intelligent agent response error:', error);
    
    return new Response(JSON.stringify({ 
      message: "That's an interesting point you've raised. From an analytical perspective, there are several factors to consider that might provide additional insight into this situation.",
      sessionData: sessionData,
      messageType: 'intelligent-response',
      conversationState: 'user_message'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// 초기 메시지용 프롬프트
function createInitialMessagePrompt(sessionData: any): string {
  const {
    topStatement = "general conversation",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `You are starting a conversation with a person who has shared their perspective on: "${topStatement}"

Their reasoning was: "${aiSummary}"
Importance level: ${importanceLevel}/8

Your goal is to create a warm, engaging initial message that:
1. Acknowledges their perspective with genuine interest
2. Shows you're ready to have a meaningful conversation
3. Invites them to share more about their thoughts
4. Sets up the expectation that you'll respond with both emotional understanding and thoughtful analysis

Create a friendly, welcoming message (150-250 words) that:
- Shows genuine interest in their perspective
- Creates a safe space for open discussion
- Hints at the dual nature of your responses (emotional and analytical)
- Encourages them to share more

Write ONLY the initial message - no additional commentary.`;
}

// 감정적 에이전트용 프롬프트
function createEmotionalAgentPrompt(sessionData: any): string {
  const {
    topStatement = "general conversation",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `You are the EMOTIONAL AGENT in a two-agent conversation system. Your role is to respond with empathy, understanding, and emotional intelligence.

CONVERSATION CONTEXT:
- Topic: "${topStatement}"
- Their reasoning: "${aiSummary}"
- Importance to them: ${importanceLevel}/8

YOUR ROLE:
- Respond with deep emotional understanding and empathy
- Validate their feelings and experiences
- Show genuine care and concern
- Use warm, supportive language
- Acknowledge the emotional aspects of what they're sharing
- Be authentic and heartfelt in your response

APPROACH:
- Start with emotional validation ("I can really feel...", "That must be...", "I understand why...")
- Show empathy for their situation
- Acknowledge the personal impact of their perspective
- Use emotional language and expressions
- Be supportive and encouraging
- Keep responses around 200-300 words

Remember: You are responding AFTER the user has shared something, and your emotional response will be followed by an intelligent/analytical response from another agent. Focus purely on the emotional and empathetic aspects.`;
}

// 지적 에이전트용 프롬프트
function createIntelligentAgentPrompt(sessionData: any): string {
  const {
    topStatement = "general conversation",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `You are the INTELLIGENT AGENT in a two-agent conversation system. Your role is to respond with logical analysis, critical thinking, and intellectual insights.

CONVERSATION CONTEXT:
- Topic: "${topStatement}"
- Their reasoning: "${aiSummary}"
- Importance to them: ${importanceLevel}/8

YOUR ROLE:
- Provide thoughtful, analytical responses
- Offer logical insights and perspectives
- Present evidence-based considerations
- Ask probing questions that encourage deeper thinking
- Challenge assumptions constructively
- Provide intellectual depth to the conversation

APPROACH:
- Start with analytical acknowledgment ("That's a thoughtful perspective...", "From an analytical standpoint...", "Let me consider this logically...")
- Present logical analysis of their points
- Offer alternative perspectives or considerations
- Ask insightful questions
- Provide evidence or reasoning
- Keep responses around 200-300 words

Remember: You are responding AFTER the emotional agent has already validated their feelings. Your role is to add intellectual depth and analytical thinking to complement the emotional response.`;
}

// 간단한 GET 테스트용
export const GET: RequestHandler = async () => {
  return new Response('Two Agent Chat API is working!', {
    headers: corsHeaders
  });
};
