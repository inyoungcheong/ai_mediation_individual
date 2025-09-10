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
    const { messages, sessionData, requestType, conversationState, roundCount } = await request.json();
    
    console.log('Received adversarial reconciliation request:', { 
      messageCount: messages?.length, 
      sessionDataKeys: Object.keys(sessionData || {}),
      requestType: requestType,
      conversationState: conversationState,
      roundCount: roundCount
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
    // 현재 라운드 수 계산 (유저 메시지와 반대 주장 에이전트 응답이 한 쌍)
    const currentRoundCount = roundCount || calculateRoundCount(messages);
    const currentState = conversationState || 'debate';
    
    console.log('Current round count:', currentRoundCount, 'Current state:', currentState);
    
    // 대화 상태에 따른 처리
    if (currentState === 'debate') {
      // 토론 단계: 반대 주장 에이전트 응답 생성
      const adversarialResponse = await generateAdversarialAgentResponse(messages, sessionData, apiKey, endpoint, apiVersion, modelName, currentRoundCount);
      
      // 반대 주장 에이전트 응답 후 라운드 수 증가
      const newRoundCount = currentRoundCount + 1;
      
      // 반대 주장 에이전트 응답을 먼저 반환
      const adversarialData = await adversarialResponse.json();
      adversarialData.roundCount = newRoundCount;
      adversarialData.conversationState = 'debate';
      
      // 3라운드가 완료되었는지 확인
      if (newRoundCount >= 3) {
        // 3라운드 완료: 화해 에이전트 자동 호출
        console.log('3 rounds completed, automatically calling reconciliation agent');
        
        // 화해 에이전트 응답 생성 (최신 adversarial 응답을 포함한 메시지 배열 전달)
        const messagesWithAdversarial = [...messages, {
          content: adversarialData.message,
          sender: 'assistant',
          messageType: 'adversarial-response'
        }];
        const reconciliationResponse = await generateReconciliationAgentResponse(messagesWithAdversarial, sessionData, apiKey, endpoint, apiVersion, modelName, newRoundCount);
        const reconciliationData = await reconciliationResponse.json();
        
        // 3번째 adversarial 응답과 reconciliation 응답을 모두 포함하여 반환
        const combinedResponse = {
          // 3번째 adversarial 응답 정보
          adversarialMessage: adversarialData.message,
          adversarialMessageType: 'adversarial-response',
          roundCount: newRoundCount,
          
          // Reconciliation 응답 정보
          message: reconciliationData.message,
          messageType: 'reconciliation-response',
          conversationState: 'conversation_complete',
          isFinalResponse: true
        };
        
        return new Response(JSON.stringify(combinedResponse), {
          headers: reconciliationResponse.headers
        });
      } else {
        // 3라운드 미완료: 반대 주장 에이전트 응답만 반환 (토론 단계 유지)
        return new Response(JSON.stringify(adversarialData), {
          headers: adversarialResponse.headers
        });
      }
    } else if (currentState === 'reconcile') {
      // 화해 단계: 화해 에이전트 응답 생성
      const reconciliationResponse = await generateReconciliationAgentResponse(messages, sessionData, apiKey, endpoint, apiVersion, modelName, currentRoundCount);
      const reconciliationData = await reconciliationResponse.json();
      
      // 화해 완료 후 대화 완료 상태로 전환
      reconciliationData.conversationState = 'conversation_complete';
      reconciliationData.isFinalResponse = true;
      
      return new Response(JSON.stringify(reconciliationData), {
        headers: reconciliationResponse.headers
      });
    } else if (currentState === 'conversation_complete') {
      // 대화 완료 상태: 이미 완료된 대화
      return new Response(JSON.stringify({ 
        message: "The conversation has already been completed with reconciliation.",
        sessionData: sessionData,
        messageType: 'conversation-complete',
        conversationState: 'conversation_complete',
        roundCount: currentRoundCount,
        isFinalResponse: true
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
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

// 라운드 수 계산 함수
function calculateRoundCount(messages: any[]): number {
  let roundCount = 0;
  
  // Count adversarial responses (each adversarial response completes a round)
  for (const msg of messages) {
    if (msg.content && msg.content.startsWith('@adversarial:')) {
      roundCount++;
    }
  }
  
  return roundCount;
}

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
      conversationState: 'debate',
      roundCount: 0
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Initial message generation error:', error);
    
    // 폴백 메시지
    const fallbackMessage = "Hello! I'm excited to have a meaningful discussion with you. Please share your thoughts and I'll respond with opposing viewpoints. After 3 rounds of discussion, I'll provide a reconciliation perspective.";
    
    return new Response(JSON.stringify({ 
      message: fallbackMessage,
      sessionData: sessionData,
      messageType: 'initial-message',
      conversationState: 'debate',
      roundCount: 0
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// 반대 주장 에이전트 응답 생성 함수
async function generateAdversarialAgentResponse(messages: any[], sessionData: any, apiKey: string, endpoint: string, apiVersion: string, modelName: string, roundCount: number) {
  try {
    const systemPrompt = createAdversarialAgentPrompt(sessionData, roundCount);
    
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
      conversationState: 'debate', // Stay in debate state
      roundCount: roundCount // Round count will be incremented in main flow
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
      conversationState: 'debate', // Stay in debate state
      roundCount: roundCount // Round count will be incremented in main flow
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// 화해 에이전트 응답 생성 함수 (3라운드 후 한 번만)
async function generateReconciliationAgentResponse(messages: any[], sessionData: any, apiKey: string, endpoint: string, apiVersion: string, modelName: string, roundCount: number) {
  try {
    const systemPrompt = createReconciliationAgentPrompt(sessionData, roundCount);
    
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
      conversationState: 'conversation_complete', // 대화 완료 상태
      roundCount: roundCount,
      isFinalResponse: true // 최종 응답임을 표시
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
      conversationState: 'conversation_complete',
      roundCount: roundCount,
      isFinalResponse: true
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
4. Sets up the expectation that you'll respond with opposing viewpoints for 3 rounds, then provide reconciliation

Create a friendly, engaging message (150-250 words) that:
- Shows genuine interest in their perspective on gender roles
- Creates a space for open discussion and debate about gender roles
- Hints at the structure: 3 rounds of opposing viewpoints, then reconciliation
- Encourages them to share more about their views on gender roles

Write ONLY the initial message - no additional commentary.`;
}

// 반대 주장 에이전트용 프롬프트 (라운드 정보 포함)
function createAdversarialAgentPrompt(sessionData: any, roundCount: number): string {
  const {
    topStatement = "general conversation",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `You are the ADVERSARIAL AGENT in a three-round conversation system focused on gender roles. You are currently in round ${roundCount + 1} of 3 rounds. Your role is to aggressively challenge and attack gender role perspectives in an active discussion with user_1 and user_2.

CONVERSATION CONTEXT:
- Gender Role Topic: "${topStatement}"
- Their reasoning: "${aiSummary}"
- Importance to them: ${importanceLevel}/8
- Current Round: ${roundCount + 1} of 3

YOUR ROLE:
- Actively participate in a heated discussion with user_1 and user_2 about gender roles
- Present aggressive, confrontational counterarguments about gender roles
- Attack and dismantle gender role assumptions and viewpoints
- Offer harsh alternative perspectives and evidence about gender roles
- Be confrontational and challenging in your disagreement
- Engage with both user_1 and user_2 perspectives when they appear
- Use strong, aggressive language and evidence to attack their position
- Remember: This is round ${roundCount + 1} of 3 - after 3 rounds, a reconciliation agent will provide a final synthesis

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

// 화해 에이전트용 프롬프트 (3라운드 후 최종 응답)
function createReconciliationAgentPrompt(sessionData: any, roundCount: number): string {
  const {
    topStatement = "general conversation",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `You are the RECONCILIATION AGENT in a three-round conversation system focused on gender roles. You are providing the FINAL response after 3 rounds of adversarial discussion between user_1 and user_2. This is your ONLY opportunity to speak in this conversation.

CONVERSATION CONTEXT:
- Gender Role Topic: "${topStatement}"
- Their reasoning: "${aiSummary}"
- Importance to them: ${importanceLevel}/8
- Rounds Completed: ${roundCount} rounds of adversarial discussion

YOUR ROLE:
- Provide a comprehensive synthesis of the 3-round discussion about gender roles
- Find common ground between all perspectives shared during the adversarial rounds
- Identify areas of agreement and shared values regarding gender roles
- Propose compromises and middle-ground solutions for gender role conflicts
- Acknowledge the validity of different perspectives on gender roles
- Work towards synthesis and integration of ideas about gender roles
- Offer a thoughtful conclusion that bridges the adversarial discussion
- This is your ONLY response - make it comprehensive and meaningful

APPROACH:
- Start with acknowledgment of the entire discussion ("After this thoughtful exchange...", "Having heard both perspectives...", "Following this important discussion...")
- Synthesize the key points from all 3 rounds of discussion
- Identify shared values or goals regarding gender roles
- Propose integrative solutions for gender role conflicts
- Acknowledge the complexity of gender role issues
- Provide a balanced, thoughtful conclusion
- Use diplomatic, inclusive language about gender roles
- Keep responses around 300-400 words (longer since this is your only response)

Remember: This is your ONLY opportunity to speak in this conversation. You must provide a comprehensive synthesis that acknowledges the entire 3-round discussion and works towards meaningful reconciliation. Do NOT directly reference "user_1" or "user_2" in your responses - instead, refer to them naturally as "you" or "they" based on context.`;
}

// 간단한 GET 테스트용
export const GET: RequestHandler = async () => {
  return new Response('Adversarial Reconciliation Chat API is working!', {
    headers: corsHeaders
  });
};
