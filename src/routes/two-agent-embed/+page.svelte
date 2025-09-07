<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let messages = [];
  let inputValue = '';
  let isLoading = false;
  let sessionData = {};
  let chatContainer;
  let conversationState = 'user_message'; // 'user_message', 'emotional_response', 'intelligent_response'
  
  onMount(async () => {
    if (browser) {
      // 강제로 레이아웃 고정 (실제 내용으로)
      messages = [{
        id: 0,
        content: '<div style="padding: 20px 0; color: #888;">Loading personalized message...</div>',
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        agentType: 'loading'
      }];
      
      // 레이아웃 안정화 후 실제 메시지 로드
      setTimeout(async () => {
        await initializeChatWithPersonalizedMessage();
      }, 100);
    }
  });

  // URL에서 세션 데이터 추출
  function getSessionDataFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      topStatement: urlParams.get('topStatement') || '',
      aiSummary: urlParams.get('aiSummary') || '',
      importanceLevel: urlParams.get('importanceLevel') || '',
      userReasoning: urlParams.get('userReasoning') || ''
    };
  }

  // 페이지 로드 시 초기 메시지 생성
  async function initializeChatWithPersonalizedMessage() {
    sessionData = getSessionDataFromURL();
    
    console.log('Initializing two-agent chat with session data:', sessionData);
    
    try {
      // 개인화된 초기 메시지 생성
      const initialMessage = await generatePersonalizedInitialMessage(sessionData);
      
      // 챗봇에 초기 메시지 설정
      addInitialMessageToChat(initialMessage);
      
    } catch (error) {
      console.error('Failed to generate personalized initial message:', error);
      
      // 폴백 메시지
      const fallbackMessage = `Hello! I'm excited to have a conversation with you. I'll be responding with both emotional understanding and thoughtful analysis. What would you like to discuss?`;
      
      addInitialMessageToChat(fallbackMessage);
    }
  }

  // 개인화된 초기 메시지 생성
  async function generatePersonalizedInitialMessage(sessionData) {
    const response = await fetch('/api/two_agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [],
        sessionData: sessionData,
        requestType: 'initial-message'
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      message: data.message,
      conversationState: data.conversationState
    };
  }

  // 챗봇에 초기 메시지 추가
  function addInitialMessageToChat(response) {
    // aiSummary를 user 메시지로 히스토리에 추가 (UI에서는 보이지 않음)
    const aiSummaryMessage = {
      id: Date.now() - 1,
      content: sessionData.aiSummary || '',
      sender: 'user',
      timestamp: new Date().toISOString(),
      agentType: 'hidden', // UI에서 숨김 처리
      hidden: true // 숨김 플래그
    };
    
    // 초기 메시지를 assistant로 추가
    const initialMessage = {
      id: Date.now(),
      content: response.message, // 원본 메시지 저장 (태그 포함)
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      agentType: 'initial'
    };
    
    // 히스토리 구성: aiSummary (hidden) -> initial message
    messages = [aiSummaryMessage, initialMessage];
    
    conversationState = response.conversationState || 'user_message';
    console.log('Initial message added to chat with aiSummary in history:', response.message.substring(0, 100) + '...');
  }

  // AI 메시지 포맷팅 함수 (표시용)
  function formatAIMessage(message) {
    return message
      // ** bold ** 처리
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // * italic * 처리  
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // 불렛 포인트 처리 (- 로 시작하는 줄들)
      .replace(/^- (.+)$/gm, '• $1')
      // 연구 결과나 데이터 관련 줄들을 불렛 포인트로
      .replace(/^(Research|Studies|Data|Evidence|A study)(.+)$/gm, '• $1$2')
      // 줄바꿈 처리
      .replace(/\n/g, '<br>');
  }

  // AI 메시지 표시용 포맷팅 함수 (태그 제거)
  function formatAIMessageForDisplay(message) {
    return message
      // @emotional: 및 @intelligent: 태그 제거
      .replace(/@(emotional|intelligent): /g, '')
      // ** bold ** 처리
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // * italic * 처리  
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // 불렛 포인트 처리 (- 로 시작하는 줄들)
      .replace(/^- (.+)$/gm, '• $1')
      // 연구 결과나 데이터 관련 줄들을 불렛 포인트로
      .replace(/^(Research|Studies|Data|Evidence|A study)(.+)$/gm, '• $1$2')
      // 줄바꿈 처리
      .replace(/\n/g, '<br>');
  }

  // 메시지 전송
  async function sendMessage() {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now(),
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
      agentType: 'user'
    };
    
    messages = [...messages, userMessage];
    inputValue = '';
    isLoading = true;
    conversationState = 'user_message';
    
    // 스크롤을 아래로
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
    
    try {
      // 감정적 에이전트 응답 요청
      const emotionalResponse = await fetch('/api/two_agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          sessionData: sessionData,
          conversationState: 'user_message'
        })
      });
      
      if (!emotionalResponse.ok) {
        throw new Error(`API error: ${emotionalResponse.status}`);
      }
      
      const emotionalData = await emotionalResponse.json();
      
      const emotionalMessage = {
        id: Date.now() + 1,
        content: emotionalData.message, // 원본 메시지 저장 (태그 포함)
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        agentType: 'emotional'
      };
      
      messages = [...messages, emotionalMessage];
      conversationState = emotionalData.conversationState;
      
      // 스크롤을 아래로
      setTimeout(() => {
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
      
      // 잠시 대기 후 지적 에이전트 응답 요청
      setTimeout(async () => {
        try {
          const intelligentResponse = await fetch('/api/two_agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: messages,
              sessionData: sessionData,
              conversationState: 'emotional_response'
            })
          });
          
          if (!intelligentResponse.ok) {
            throw new Error(`API error: ${intelligentResponse.status}`);
          }
          
          const intelligentData = await intelligentResponse.json();
          
          const intelligentMessage = {
            id: Date.now() + 2,
            content: intelligentData.message, // 원본 메시지 저장 (태그 포함)
            sender: 'assistant',
            timestamp: new Date().toISOString(),
            agentType: 'intelligent'
          };
          
          messages = [...messages, intelligentMessage];
          conversationState = intelligentData.conversationState;
          
          // 스크롤을 아래로
          setTimeout(() => {
            if (chatContainer) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }, 100);
          
        } catch (error) {
          console.error('Intelligent agent error:', error);
          
          const errorMessage = {
            id: Date.now() + 2,
            content: "I'm having trouble providing an analytical perspective right now. Could you please try again?",
            sender: 'assistant',
            timestamp: new Date().toISOString(),
            agentType: 'intelligent'
          };
          
          messages = [...messages, errorMessage];
        } finally {
          isLoading = false;
        }
      }, 1500); // 1.5초 대기
      
    } catch (error) {
      console.error('Emotional agent error:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        content: "I'm sorry, I'm having trouble processing your message right now. Could you please try again?",
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        agentType: 'emotional'
      };
      
      messages = [...messages, errorMessage];
      isLoading = false;
    }
  }

  // 엔터키로 메시지 전송
  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  // 에이전트 타입에 따른 스타일 클래스 반환
  function getAgentClass(agentType) {
    switch(agentType) {
      case 'emotional':
        return 'emotional-agent';
      case 'intelligent':
        return 'intelligent-agent';
      case 'initial':
        return 'initial-message';
      default:
        return '';
    }
  }

  // 에이전트 타입에 따른 라벨 반환
  function getAgentLabel(agentType) {
    switch(agentType) {
      case 'emotional':
        return '💝 Emotional Agent';
      case 'intelligent':
        return '🧠 Intelligent Agent';
      case 'initial':
        return '🤖 AI Assistant';
      default:
        return '';
    }
  }
</script>

<svelte:head>
  <title>Two-Agent Research Chat</title>
</svelte:head>

<div class="chat-container">
  <div class="chat-header">
    <h3>Two-Agent Research Discussion</h3>
    <p class="subtitle">Experience both emotional understanding and analytical insights</p>
  </div>
  
  <div class="chat-messages" bind:this={chatContainer}>
    {#each messages as message (message.id)}
      {#if !message.hidden}
        <div class="message {message.sender} {getAgentClass(message.agentType)}">
          {#if message.agentType !== 'user' && message.agentType !== 'loading'}
            <div class="agent-label">
              {getAgentLabel(message.agentType)}
            </div>
          {/if}
          <div class="message-content">
            {@html formatAIMessageForDisplay(message.content)}
          </div>
          <div class="message-time">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      {/if}
    {/each}
    
    {#if isLoading}
      <div class="message assistant">
        <div class="message-content loading">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    {/if}
  </div>
  
  <div class="chat-input">
    <textarea
      bind:value={inputValue}
      on:keypress={handleKeyPress}
      placeholder="Type your message here..."
      rows="1"
      disabled={isLoading}
    ></textarea>
    <button on:click={sendMessage} disabled={isLoading || !inputValue.trim()}>
      Send
    </button>
  </div>
</div>

<style>
  /* Vercel 배너/브랜딩 숨기기 */
  :global(.vercel-banner),
  :global([data-vercel-banner]),
  :global(.vercel-branding),
  :global([class*="vercel"]),
  :global([id*="vercel"]),
  :global(div[style*="vercel"]),
  :global(div[class*="__vercel"]),
  :global(div[id*="__vercel"]) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
    position: absolute !important;
    left: -9999px !important;
  }
  
  /* 상단 고정 요소들 숨기기 */
  :global(.fixed.top-0),
  :global(.sticky.top-0),
  :global([style*="position: fixed"]),
  :global([style*="position: sticky"]) {
    display: none !important;
  }
  
  /* iframe에서 상단 여백 제거 */
  :global(body) {
    margin: 0 !important;
    padding: 0 !important;
  }
  
  /* 추가적인 브랜딩 요소들 숨기기 */
  :global([data-powered-by]),
  :global([class*="powered-by"]),
  :global([id*="powered-by"]),
  :global(.deployment-banner),
  :global(.preview-banner) {
    display: none !important;
    visibility: hidden !important;
  }

  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-width: 800px;
    margin: 0 auto;
    background: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .chat-header {
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-bottom: 1px solid #e9ecef;
    width: 100%;
    box-sizing: border-box;
    min-height: 80px;
  }
  
  .chat-header h3 {
    margin: 0 0 0.25rem 0;
    color: white;
    font-size: 1.25rem;
  }
  
  .subtitle {
    margin: 0;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.9rem;
  }
  
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .message {
    display: flex;
    flex-direction: column;
    max-width: 80%;
  }
  
  .message.user {
    align-self: flex-end;
  }
  
  .message.user .message-content {
    background: #007bff;
    color: white;
    margin-left: auto;
    border-radius: 1rem;
    padding: 0.75rem 1rem;
  }
  
  .message.assistant .message-content {
    background: white;
    color: #212529;
    border: none;
    border-radius: 0;
    padding: 1rem 0;
    font-size: 0.95rem;
    line-height: 1.6;
    max-width: 100%;
  }
  
  /* 에이전트별 스타일링 */
  .message.emotional-agent .message-content {
    background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
    color: #333;
    border-radius: 1rem;
    padding: 1rem;
    border-left: 4px solid #ff6b6b;
  }
  
  .message.intelligent-agent .message-content {
    background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
    color: #333;
    border-radius: 1rem;
    padding: 1rem;
    border-left: 4px solid #4ecdc4;
  }
  
  .message.initial-message .message-content {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 1rem;
    padding: 1rem;
  }
  
  .agent-label {
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    opacity: 0.8;
  }
  
  .message.emotional-agent .agent-label {
    color: #d63384;
  }
  
  .message.intelligent-agent .agent-label {
    color: #0d6efd;
  }
  
  .message.initial-message .agent-label {
    color: rgba(255, 255, 255, 0.9);
  }
  
  /* AI 메시지 내 formatting */
  .message.assistant .message-content :global(strong) {
    font-weight: 600;
    color: #000;
  }
  
  .message.assistant .message-content :global(em) {
    font-style: italic;
    color: #444;
  }
  
  .message.assistant .message-content :global(ul) {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  
  .message.assistant .message-content :global(li) {
    margin: 0.25rem 0;
  }
  
  .message-content {
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  
  .message-time {
    font-size: 0.75rem;
    color: #6c757d;
    margin-top: 0.25rem;
    text-align: right;
  }
  
  .message.assistant .message-time {
    text-align: left;
  }
  
  .loading {
    display: flex;
    align-items: center;
  }
  
  .typing-indicator {
    display: flex;
    gap: 0.25rem;
  }
  
  .typing-indicator span {
    width: 0.5rem;
    height: 0.5rem;
    background: #6c757d;
    border-radius: 50%;
    animation: typing 1.4s infinite;
  }
  
  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes typing {
    0%, 60%, 100% { opacity: 0.3; }
    30% { opacity: 1; }
  }
  
  .chat-input {
    display: flex;
    padding: 1rem;
    border-top: 1px solid #e9ecef;
    gap: 0.5rem;
  }
  
  .chat-input textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ced4da;
    border-radius: 0.5rem;
    resize: none;
    font-family: inherit;
  }
  
  .chat-input button {
    padding: 0.75rem 1.5rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
  }
  
  .chat-input button:hover:not(:disabled) {
    background: #0056b3;
  }
  
  .chat-input button:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
</style>
