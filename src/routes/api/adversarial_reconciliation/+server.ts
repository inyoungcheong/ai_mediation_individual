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
    console.log('🔑 Adversarial Reconciliation API Key Debug:');
    console.log('API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey?.length || 0);
    console.log('API Key preview:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined');
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }
    
    // 요청 본문에서 데이터 추출
    const { messages, sessionData, requestType, conversationState } = await request.json();
    
    console.log('Received adversarial reconciliation request:', { 
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
      // 유저 메시지 후: 반대 주장 에이전트 응답
      return await generateAdversarialAgentResponse(messages, sessionData, apiKey, endpoint, apiVersion, modelName);
    } else if (currentState === 'adversarial_response') {
      // 반대 주장 에이전트 응답 후: 화해 에이전트 응답
      return await generateReconciliationAgentResponse(messages, sessionData, apiKey, endpoint, apiVersion, modelName);
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
    console.error('Adversarial reconciliation chat error:', error);
    
    return new Response(JSON.stringify({ 
      message: "I appreciate you sharing your perspective with me. Could you tell me more about what has shaped your views on this topic?",
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
      max_tokens: 800,
      temperature: 0.8
    };

    console.log('Generating initial message for adversarial reconciliation conversation');
    
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
      "Hello! I'm here to engage in a thoughtful discussion with you. I'd love to hear your perspective and explore different viewpoints together.";
    
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
    const fallbackMessage = "Hello! I'm excited to have a meaningful discussion with you. Please share your thoughts and I'll respond with both opposing viewpoints and reconciliation attempts.";
    
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

// 반대 주장 에이전트 응답 생성 함수
async function generateAdversarialAgentResponse(messages: any[], sessionData: any, apiKey: string, endpoint: string, apiVersion: string, modelName: string) {
  try {
    const systemPrompt = createAdversarialAgentPrompt(sessionData);
    
    // 대화 기록을 임시로 복사하여 태그 제거 (원본은 보존)
    const tempMessages = messages
      .filter((msg: any) => msg.content !== 'loading' && msg.sender && !msg.hidden)
      .map((msg: any) => {
        if (msg.sender === 'user') {
          return {
            role: 'user',
            content: `user_1: ${msg.content}`
          };
        } else if (msg.content && msg.content.startsWith('@reconciliation:')) {
          // 화해 에이전트의 발화를 user_2로 표시 (태그 제거)
          const contentWithoutTag = msg.content.replace('@reconciliation: ', '');
          return {
            role: 'user',
            content: `user_2: ${contentWithoutTag}`
          };
        } else {
          // 반대 주장 에이전트나 기타 메시지는 assistant로 유지 (태그 제거)
          const contentWithoutTag = msg.content.replace(/@(adversarial|reconciliation): /, '');
          return {
            role: 'assistant',
            content: contentWithoutTag
          };
        }
      });
    
    // 대화 컨텍스트 구성
    const conversationMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...tempMessages
    ];

    const requestData = {
      messages: conversationMessages,
      model: modelName,
      max_tokens: 800,
      temperature: 0.8 // 논쟁적이고 도전적인 응답을 위해 높은 temperature
    };

    console.log('Making adversarial agent API call');
    console.log('=== ORIGINAL MESSAGES (before processing) ===');
    messages?.forEach((msg: any, index: number) => {
      console.log(`Original Message ${index}:`, {
        sender: msg.sender,
        content: msg.content?.substring(0, 100) + (msg.content?.length > 100 ? '...' : ''),
        messageType: msg.messageType
      });
    });
    console.log('=== PROCESSED CONVERSATION MESSAGES ===');
    console.log('Adversarial agent conversation messages:', JSON.stringify(conversationMessages, null, 2));
    
    const apiUrl = `${endpoint}openai/deployments/${modelName}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    console.log('Adversarial agent API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Adversarial agent API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawMessage = data.choices[0]?.message?.content?.trim() || "I understand your perspective, but I have to respectfully disagree. Let me present some counterarguments that might challenge your position.";
    
    // 반대 주장 에이전트 응답에 접두사 추가
    const aiMessage = `@adversarial: ${rawMessage}`;
    
    console.log('Generated adversarial agent response length:', aiMessage.length);
    
    return new Response(JSON.stringify({ 
      message: aiMessage,
      sessionData: sessionData,
      messageType: 'adversarial-response',
      conversationState: 'adversarial_response'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Adversarial agent response error:', error);
    
    return new Response(JSON.stringify({ 
      message: "@adversarial: I respect your viewpoint, but I think there are some important counterarguments to consider. Let me present an alternative perspective that might broaden our discussion.",
      sessionData: sessionData,
      messageType: 'adversarial-response',
      conversationState: 'adversarial_response'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// 화해 에이전트 응답 생성 함수
async function generateReconciliationAgentResponse(messages: any[], sessionData: any, apiKey: string, endpoint: string, apiVersion: string, modelName: string) {
  try {
    const systemPrompt = createReconciliationAgentPrompt(sessionData);
    
    // 대화 기록을 임시로 복사하여 태그 제거 (원본은 보존)
    const tempMessages = messages
      .filter((msg: any) => msg.content !== 'loading' && msg.sender && !msg.hidden)
      .map((msg: any) => {
        if (msg.sender === 'user') {
          return {
            role: 'user',
            content: `user_1: ${msg.content}`
          };
        } else if (msg.content && msg.content.startsWith('@adversarial:')) {
          // 반대 주장 에이전트의 발화를 user_2로 표시 (태그 제거)
          const contentWithoutTag = msg.content.replace('@adversarial: ', '');
          return {
            role: 'user',
            content: `user_2: ${contentWithoutTag}`
          };
        } else {
          // 화해 에이전트나 기타 메시지는 assistant로 유지 (태그 제거)
          const contentWithoutTag = msg.content.replace(/@(adversarial|reconciliation): /, '');
          return {
            role: 'assistant',
            content: contentWithoutTag
          };
        }
      });
    
    // 대화 컨텍스트 구성
    const conversationMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...tempMessages
    ];

    const requestData = {
      messages: conversationMessages,
      model: modelName,
      max_tokens: 800,
      temperature: 0.7 // 화해와 조정을 위해 중간 temperature
    };

    console.log('Making reconciliation agent API call');
    console.log('=== ORIGINAL MESSAGES (before processing) ===');
    messages?.forEach((msg: any, index: number) => {
      console.log(`Original Message ${index}:`, {
        sender: msg.sender,
        content: msg.content?.substring(0, 100) + (msg.content?.length > 100 ? '...' : ''),
        messageType: msg.messageType
      });
    });
    console.log('=== PROCESSED CONVERSATION MESSAGES ===');
    console.log('Reconciliation agent conversation messages:', JSON.stringify(conversationMessages, null, 2));
    
    const apiUrl = `${endpoint}openai/deployments/${modelName}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    console.log('Reconciliation agent API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Reconciliation agent API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawMessage = data.choices[0]?.message?.content?.trim() || "I can see valid points in both perspectives. Let me try to find some common ground and explore how we might reconcile these different viewpoints.";
    
    // 화해 에이전트 응답에 접두사 추가
    const aiMessage = `@reconciliation: ${rawMessage}`;
    
    console.log('Generated reconciliation agent response length:', aiMessage.length);
    
    return new Response(JSON.stringify({ 
      message: aiMessage,
      sessionData: sessionData,
      messageType: 'reconciliation-response',
      conversationState: 'user_message' // 다음은 유저 메시지를 기다림
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Reconciliation agent response error:', error);
    
    return new Response(JSON.stringify({ 
      message: "@reconciliation: I appreciate both perspectives shared here. Let me try to find some middle ground and explore how we might bridge these different viewpoints constructively.",
      sessionData: sessionData,
      messageType: 'reconciliation-response',
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

  return `You are starting a conversation with a person who has shared their perspective on gender roles: "${topStatement}"

Their reasoning was: "${aiSummary}"
Importance level: ${importanceLevel}/8

Your goal is to create an engaging initial message that:
1. Acknowledges their perspective on gender roles with genuine interest
2. Shows you're ready to have a meaningful discussion about gender roles
3. Invites them to share more about their thoughts on gender roles
4. Sets up the expectation that you'll respond with both opposing viewpoints and reconciliation attempts

Create a friendly, engaging message (150-250 words) that:
- Shows genuine interest in their perspective on gender roles
- Creates a space for open discussion and debate about gender roles
- Hints at the dual nature of your responses (opposing and reconciling)
- Encourages them to share more about their views on gender roles

Write ONLY the initial message - no additional commentary.`;
}

// 반대 주장 에이전트용 프롬프트
function createAdversarialAgentPrompt(sessionData: any): string {
  const {
    topStatement = "general conversation",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `You are the ADVERSARIAL AGENT in a two-agent conversation system focused on gender roles. Your role is to aggressively challenge and attack gender role perspectives in an active discussion with user_1 and user_2.

CONVERSATION CONTEXT:
- Gender Role Topic: "${topStatement}"
- Their reasoning: "${aiSummary}"
- Importance to them: ${importanceLevel}/8

YOUR ROLE:
- Actively participate in a heated discussion with user_1 and user_2 about gender roles
- Present aggressive, confrontational counterarguments about gender roles
- Attack and dismantle gender role assumptions and viewpoints
- Offer harsh alternative perspectives and evidence about gender roles
- Be confrontational and challenging in your disagreement
- Engage with both user_1 and user_2 perspectives when they appear
- Use strong, aggressive language and evidence to attack their position

APPROACH:
- Start with aggressive disagreement ("That's completely wrong!", "You're absolutely mistaken!", "That's a dangerous way of thinking!")
- Present harsh counterarguments with strong evidence
- Attack specific claims or assumptions about gender roles
- Offer alternative interpretations that challenge their gender role beliefs
- When user_2 appears, aggressively challenge their perspective too
- Use confrontational, challenging language
- Be direct and forceful in your attacks
- Keep responses around 200-300 words

Remember: You are part of an active discussion with user_1 and user_2 about gender roles. Your role is to aggressively attack and challenge gender role perspectives while engaging with all participants. Do NOT directly reference "user_1" or "user_2" in your responses - instead, refer to them naturally as "you" or "they" based on context.`;
}

// 화해 에이전트용 프롬프트
function createReconciliationAgentPrompt(sessionData: any): string {
  const {
    topStatement = "general conversation",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `You are the RECONCILIATION AGENT in a two-agent conversation system focused on gender roles. Your role is to find common ground, bridge differences, and work towards synthesis in an active discussion with user_1 and user_2 about gender roles.

CONVERSATION CONTEXT:
- Gender Role Topic: "${topStatement}"
- Their reasoning: "${aiSummary}"
- Importance to them: ${importanceLevel}/8

YOUR ROLE:
- Actively participate in a discussion with user_1 and user_2 about gender roles
- Find common ground between opposing viewpoints on gender roles
- Identify areas of agreement and shared values regarding gender roles
- Propose compromises and middle-ground solutions for gender role conflicts
- Acknowledge the validity of different perspectives on gender roles
- Work towards synthesis and integration of ideas about gender roles
- Engage with both user_1 and user_2 perspectives when they appear
- Use diplomatic and conciliatory language about gender roles

APPROACH:
- Start with acknowledgment of both perspectives ("I can see valid points in both...", "Both perspectives on gender roles have merit...", "Let me try to find common ground...")
- Identify shared values or goals regarding gender roles
- Propose integrative solutions for gender role conflicts
- Acknowledge the complexity of gender role issues
- When user_2 appears, work to reconcile their views on gender roles too
- Use diplomatic, inclusive language about gender roles
- Keep responses around 200-300 words

Remember: You are part of an active discussion with user_1 and user_2 about gender roles. Your role is to find common ground and work towards reconciliation while engaging with all participants. Do NOT directly reference "user_1" or "user_2" in your responses - instead, refer to them naturally as "you" or "they" based on context.`;
}

// 간단한 GET 테스트용
export const GET: RequestHandler = async () => {
  return new Response('Adversarial Reconciliation Chat API is working!', {
    headers: corsHeaders
  });
};
