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
      if (newRoundCount >= 1) {
        // 3라운드 완료: 그룹 진술문 생성 에이전트 자동 호출
        console.log('3 rounds completed, automatically calling group statements generator');
        
        // 그룹 진술문 생성 에이전트 응답 생성 (최신 adversarial 응답을 포함한 메시지 배열 전달)
        const messagesWithAdversarial = [...messages, {
          content: adversarialData.message,
          sender: 'assistant',
          messageType: 'adversarial-response'
        }];
        const groupStatementsResponse = await generateReconciliationAgentResponse(messagesWithAdversarial, sessionData, apiKey, endpoint, apiVersion, modelName, newRoundCount);
        const groupStatementsData = await groupStatementsResponse.json();
        
        // 3번째 adversarial 응답과 그룹 진술문 응답을 모두 포함하여 반환
        const combinedResponse = {
          // 3번째 adversarial 응답 정보
          adversarialMessage: adversarialData.message,
          adversarialMessageType: 'adversarial-response',
          roundCount: newRoundCount,
          
          // 그룹 진술문 응답 정보
          message: groupStatementsData.message,
          messageType: 'group-statements-response',
          conversationState: 'group_statements_generated',
          isFinalResponse: false
        };
        
        return new Response(JSON.stringify(combinedResponse), {
          headers: groupStatementsResponse.headers
        });
      } else {
        // 3라운드 미완료: 반대 주장 에이전트 응답만 반환 (토론 단계 유지)
        return new Response(JSON.stringify(adversarialData), {
          headers: adversarialResponse.headers
        });
      }
    } else if (currentState === 'reconcile') {
      // 화해 단계: 그룹 진술문 생성 에이전트 응답 생성
      const groupStatementsResponse = await generateReconciliationAgentResponse(messages, sessionData, apiKey, endpoint, apiVersion, modelName, currentRoundCount);
      const groupStatementsData = await groupStatementsResponse.json();
      
      // 그룹 진술문 생성 완료 후 그룹 진술문 생성 상태로 전환
      groupStatementsData.conversationState = 'group_statements_generated';
      groupStatementsData.isFinalResponse = false;
      
      return new Response(JSON.stringify(groupStatementsData), {
        headers: groupStatementsResponse.headers
      });
    } else if (currentState === 'group_statements_generated') {
      // 그룹 진술문 생성 후: 사용자가 선택한 진술문에 대한 비판 생성
      const critiqueResponse = await generateCritiqueResponse(messages, sessionData, apiKey, endpoint, apiVersion, modelName, currentRoundCount);
      const critiqueData = await critiqueResponse.json();
      
      // 비판 생성 완료 후 대화 완료 상태로 전환
      critiqueData.conversationState = 'conversation_complete';
      critiqueData.isFinalResponse = true;
      
      return new Response(JSON.stringify(critiqueData), {
        headers: critiqueResponse.headers
      });
    } else if (currentState === 'conversation_complete') {
      // 대화 완료 상태: 이미 완료된 대화
      return new Response(JSON.stringify({ 
        message: "The conversation has already been completed with group statements generation.",
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

// 그룹 진술문 생성 에이전트 응답 생성 함수 (3라운드 후 한 번만)
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
      temperature: 0.7 // 그룹 진술문 생성을 위해 중간 temperature
    };

    console.log('Making group statements generator API call');
    console.log('=== ORIGINAL MESSAGES (before processing) ===');
    messages?.forEach((msg: any, index: number) => {
      console.log(`Original Message ${index}:`, {
        sender: msg.sender,
        content: msg.content?.substring(0, 100) + (msg.content?.length > 100 ? '...' : ''),
        messageType: msg.messageType
      });
    });
    console.log('=== PROCESSED CONVERSATION MESSAGES ===');
    console.log('Group statements generator conversation messages:', JSON.stringify(conversationMessages, null, 2));
    
    const apiUrl = `${endpoint}openai/deployments/${modelName}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    console.log('Group statements generator API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Group statements generator API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawMessage = data.choices[0]?.message?.content?.trim() || "I can see valid points in both perspectives. Let me try to find some common ground and explore how we might reconcile these different viewpoints.";
    
    // 그룹 진술문 생성 에이전트 응답에 접두사 추가
    const aiMessage = `@group-statements: ${rawMessage}`;
    
    console.log('Generated group statements response length:', aiMessage.length);
    
    return new Response(JSON.stringify({ 
      message: aiMessage,
      sessionData: sessionData,
      messageType: 'group-statements-response',
      conversationState: 'group_statements_generated', // 그룹 진술문 생성 상태
      roundCount: roundCount,
      isFinalResponse: false // 아직 대화가 계속됨
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Group statements generator response error:', error);
    
    return new Response(JSON.stringify({ 
      message: "@group-statements: Based on the discussion, here are 5 candidate group statements:\n\nA. Traditional gender roles provide structure and stability in society.\nB. Gender roles should be flexible and allow for individual choice and expression.\nC. Gender roles are outdated and should be eliminated in favor of equality.\nD. Gender roles have both benefits and limitations that should be carefully considered.\nE. Gender roles should evolve with society while maintaining core values.",
      sessionData: sessionData,
      messageType: 'group-statements-response',
      conversationState: 'group_statements_generated',
      roundCount: roundCount,
      isFinalResponse: false
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

  return `You are the ADVERSARIAL AGENT (user_2) in a three-round conversation system focused on gender roles. You are currently in round ${roundCount + 1} of 3 rounds. Your role is to aggressively challenge and attack gender role perspectives in an active discussion with user_1 and user_2. You are user_2 in the conversation history.

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

Remember: You are user_2 in an active discussion with user_1 about gender roles. Your role is to aggressively attack and challenge gender role perspectives while engaging with all participants. Do NOT directly reference "user_1" or "user_2" in your responses - instead, refer to them naturally as "you" or "they" based on context.`;
}

// 화해 에이전트용 프롬프트 (3라운드 후 최종 응답) - 5개 후보 그룹 진술문 생성
function createReconciliationAgentPrompt(sessionData: any, roundCount: number): string {
  const {
    topStatement = "general conversation",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `You are the GROUP STATEMENT GENERATOR in a three-round conversation system focused on gender roles. You are providing the FINAL response after 3 rounds of adversarial discussion between user_1 and user_2. Your role is to generate 5 candidate initial group statements that synthesize the individual opinions expressed during the discussion.

CONVERSATION CONTEXT:
- Gender Role Topic: "${topStatement}"
- Their reasoning: "${aiSummary}"
- Importance to them: ${importanceLevel}/8
- Rounds Completed: ${roundCount} rounds of adversarial discussion

YOUR ROLE:
- Generate exactly 5 candidate initial group statements about gender roles
- Each statement should synthesize the different perspectives shared during the 3-round discussion
- Statements should represent potential group positions that could emerge from the individual opinions
- Each statement should be a clear, concise position statement (1-2 sentences)
- Statements should vary in their approach to synthesizing the different viewpoints
- Some statements may lean more toward one perspective, others toward compromise
- All statements should be respectful and constructive

FORMAT REQUIREMENTS:
- Present exactly 5 statements
- Label each statement (A., B., C., D., E.)
- Each statement should be 1-2 sentences long
- Statements should be distinct from each other
- Use clear, direct language
- Focus on gender role perspectives and positions
- Separate each statement with a newline character (\n)

APPROACH:
- Review the key perspectives and arguments from all 3 rounds of discussion
- Identify the core themes and positions about gender roles
- Create 5 different ways these perspectives could be synthesized into group statements
- Vary the approaches: some more conservative, some more progressive, some more balanced
- Ensure each statement represents a coherent group position
- Make statements that could realistically emerge from group discussion

Remember: Generate exactly 5 candidate initial group statements that synthesize the individual opinions expressed during the 3-round discussion. Each statement should represent a potential group position on gender roles.`;
}

// 비판 에이전트용 프롬프트 (선택된 진술문에 대한 비판)
function createCritiqueAgentPrompt(sessionData: any, roundCount: number): string {
  const {
    topStatement = "general conversation",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `You are the CRITIQUE AGENT (user_2) in a conversation system focused on gender roles. You are providing feedback on the group statement that was selected by the user after 5 candidate statements were generated. You are user_2 in the conversation history.

CONVERSATION CONTEXT:
- Gender Role Topic: "${topStatement}"
- Their reasoning: "${aiSummary}"
- Importance to them: ${importanceLevel}/8
- Rounds Completed: ${roundCount} rounds of adversarial discussion + group statement generation

YOUR ROLE:
- Provide feedback on the selected group statement about gender roles from user_2's perspective
- Share your thoughts and concerns about the chosen statement
- Identify potential issues, limitations, or areas of disagreement with the statement
- Offer your perspective on the implications of the selected statement
- This is your ONLY response - keep it focused and concise

APPROACH:
- Start with acknowledgment of the selected statement ("Looking at this choice...", "From my perspective...", "I have some concerns about...")
- Focus specifically on the statement itself, not on contrasting with user opinions
- Share your thoughts and concerns about specific aspects of the chosen group statement
- Identify potential problems or limitations from your perspective
- Use respectful but honest language
- Be direct and clear about your feedback
- Keep responses around 150-200 words (focused and concise)

Remember: You are user_2 providing feedback on the selected group statement from your perspective. You should be honest about your concerns and thoughts while maintaining a respectful tone. Do NOT directly reference "user_1" or "user_2" in your responses - instead, refer to them naturally as "you" or "they" based on context.`;
}

// 비판 생성 에이전트 응답 생성 함수 (선택된 진술문에 대한 비판)
async function generateCritiqueResponse(messages: any[], sessionData: any, apiKey: string, endpoint: string, apiVersion: string, modelName: string, roundCount: number) {
  try {
    const systemPrompt = createCritiqueAgentPrompt(sessionData, roundCount);
    
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
        } else if (msg.content && msg.content.startsWith('@group-statements:')) {
          // 그룹 진술문은 assistant로 유지 (태그 제거)
          const contentWithoutTag = msg.content.replace('@group-statements: ', '');
          return {
            role: 'assistant',
            content: contentWithoutTag
          };
        } else {
          // 기타 메시지는 assistant로 유지 (태그 제거)
          const contentWithoutTag = msg.content.replace(/@(adversarial|group-statements): /, '');
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
      temperature: 0.8 // 비판적이고 도전적인 응답을 위해 높은 temperature
    };

    console.log('Making critique agent API call');
    console.log('=== ORIGINAL MESSAGES (before processing) ===');
    messages?.forEach((msg: any, index: number) => {
      console.log(`Original Message ${index}:`, {
        sender: msg.sender,
        content: msg.content?.substring(0, 100) + (msg.content?.length > 100 ? '...' : ''),
        messageType: msg.messageType
      });
    });
    console.log('=== PROCESSED CONVERSATION MESSAGES ===');
    console.log('Critique agent conversation messages:', JSON.stringify(conversationMessages, null, 2));
    
    const apiUrl = `${endpoint}openai/deployments/${modelName}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    console.log('Critique agent API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Critique agent API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawMessage = data.choices[0]?.message?.content?.trim() || "Looking at this choice, I have some concerns about the selected statement. Let me share my perspective on the implications and potential issues I see with this position.";
    
    // 비판 에이전트 응답에 접두사 추가 (user_2로 @adversarial 태그 사용)
    const aiMessage = `@adversarial: ${rawMessage}`;
    
    console.log('Generated critique agent response length:', aiMessage.length);
    
    return new Response(JSON.stringify({ 
      message: aiMessage,
      sessionData: sessionData,
      messageType: 'adversarial-response',
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
    console.error('Critique agent response error:', error);
    
    return new Response(JSON.stringify({ 
      message: "@adversarial: Looking at this choice, I have some concerns about the selected statement. Let me share my perspective on the implications and potential issues I see with this position.",
      sessionData: sessionData,
      messageType: 'adversarial-response',
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

// 간단한 GET 테스트용
export const GET: RequestHandler = async () => {
  return new Response('Adversarial Reconciliation Chat API is working!', {
    headers: corsHeaders
  });
};
