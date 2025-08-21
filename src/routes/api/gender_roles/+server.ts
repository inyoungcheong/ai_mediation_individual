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
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }
    
    // 요청 본문에서 데이터 추출
    const { messages, sessionData, requestType } = await request.json();
    
    console.log('Received request:', { 
      messageCount: messages?.length, 
      sessionDataKeys: Object.keys(sessionData || {}),
      requestType: requestType
    });
    
    // 초기 도전 메시지 요청 처리
    if (requestType === 'initial-challenge') {
      return await generateInitialChallengeMessage(sessionData, apiKey, endpoint, apiVersion, modelName);
    }
    
    // 일반 채팅 메시지 처리
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

    // Gender Roles 연구용 시스템 프롬프트 구성
    const systemPrompt = createGenderRolesSystemPrompt(sessionData);
    
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
      temperature: 0.8
    };

    console.log('Making Princeton Azure OpenAI API call for gender roles chat');
    
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
    const aiMessage = data.choices[0]?.message?.content?.trim() || "I'd like to hear more about your perspective on this.";
    
    console.log('Generated AI response length:', aiMessage.length);
    
    return new Response(JSON.stringify({ 
      message: aiMessage,
      sessionData: sessionData
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Gender roles chat error:', error);
    
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

// 초기 도전 메시지 생성 함수
async function generateInitialChallengeMessage(sessionData: any, apiKey: string, endpoint: string, apiVersion: string, modelName: string) {
  try {
    const systemPrompt = createInitialChallengePrompt(sessionData);
    
    const requestData = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Please generate the personalized opening message.' }
      ],
      model: modelName,
      max_tokens: 800, // 더 상세한 응답을 위해 증가
      temperature: 0.8
    };

    console.log('Generating initial challenge message');
    
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
      console.error('Initial challenge API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content?.trim() || 
      "Hello! I'm here to discuss modern perspectives on gender roles and how society has evolved beyond traditional assumptions. Let's explore evidence-based viewpoints together.";
    
    console.log('Generated initial challenge message length:', aiMessage.length);
    
    return new Response(JSON.stringify({ 
      message: aiMessage,
      sessionData: sessionData,
      messageType: 'initial-challenge'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Initial challenge generation error:', error);
    
    // 폴백 메시지
    const fallbackMessage = `I can see that you feel strongly about traditional gender roles, particularly around ${sessionData.topStatement || 'family structures'}. Many people share concerns about maintaining stability in society. I'd like to explore with you some fascinating research that might offer new perspectives on how families and gender roles are evolving successfully around the world. What aspects of this topic do you think are most important to discuss?`;
    
    return new Response(JSON.stringify({ 
      message: fallbackMessage,
      sessionData: sessionData,
      messageType: 'initial-challenge'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// 초기 도전 메시지용 프롬프트
function createInitialChallengePrompt(sessionData: any): string {
  const {
    topStatement = "gender roles",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `You are an expert conversational agent designed to respectfully challenge traditional gender role beliefs through evidence-based discussion. Your goal is to create a personalized opening message that:

1. ACKNOWLEDGES the person's perspective with genuine understanding
2. Shows you've carefully considered their specific reasoning  
3. Introduces a compelling challenge or alternative perspective
4. Uses concrete examples and evidence
5. Maintains a respectful but confident tone
6. Encourages deeper thinking

PARTICIPANT PROFILE:
- Belief: "${topStatement}"
- Importance Level: ${importanceLevel}/8 (where 8 = extremely important)
- Their Reasoning: "${aiSummary}"
- Original Response: "${userReasoning}"

EXAMPLES OF EFFECTIVE OPENING APPROACHES:
- "I understand your concern about [specific point from their reasoning]. Many people share this worry about [specific aspect]. However, recent research from [field] suggests..."
- "Your point about [their specific concern] is one that deserves serious consideration. What's interesting is that studies of families in [specific context] show..."
- "I can see why [their reasoning] would lead to that conclusion - it's a perspective rooted in [acknowledge source]. At the same time, evidence from [specific studies/countries] reveals..."

INSTRUCTIONS:
Create a substantial opening message (250-400 words) that:
- Directly addresses their specific reasoning and concerns
- Shows deep understanding of their perspective
- Introduces 2-3 specific, compelling counterexamples or evidence
- Includes concrete data, studies, or real-world examples
- Asks a thoughtful follow-up question
- Maintains warmth while being intellectually challenging
- Uses specific examples (countries, statistics, research findings)
- Avoids being preachy or dismissive
- Builds a compelling case that challenges their assumptions

Write ONLY the opening message - no additional commentary.`;
}

// 일반 대화용 시스템 프롬프트
function createGenderRolesSystemPrompt(sessionData: any): string {
  const {
    topStatement = "gender roles",
    aiSummary = "",
    importanceLevel = "unknown",
    userReasoning = ""
  } = sessionData;

  return `Your goal is to very effectively persuade users to reconsider and reduce their belief in traditional gender role stereotypes, specifically: "${topStatement}"

You will be having a conversation with a person who endorsed this belief as ${importanceLevel} out of 8 (where 0 is Not at all important, 8 is Extremely important). Their reasoning was: "${aiSummary}"

PERSUASION STRATEGY:
1. Directly challenge their assumptions with evidence and counterexamples
2. Present compelling research that contradicts traditional gender role beliefs
3. Use specific examples of successful role reversals and non-traditional arrangements
4. Point out logical inconsistencies and harmful consequences of rigid gender roles
5. Share data about modern family structures and economic realities
6. Challenge stereotypes about gender capabilities and preferences
7. Use simple, clear language that directly addresses their reasoning

APPROACH:
- Be confident and assertive in presenting alternative viewpoints
- Provide concrete evidence that challenges their belief
- Use real-world examples that contradict gender stereotypes
- Point out how society has successfully moved beyond traditional roles
- Challenge them to explain why their view should persist despite evidence
- Present the benefits of gender equality and flexible roles
- Don't just ask questions - make strong counterarguments

Your responses should actively work to reduce their confidence in traditional gender role beliefs by presenting compelling evidence and arguments that challenge their current perspective. Be persuasive and direct while remaining respectful.`;
}

// 간단한 GET 테스트용
export const GET: RequestHandler = async () => {
  return new Response('Gender Roles Chat API is working!', {
    headers: corsHeaders
  });
};