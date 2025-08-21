<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let messages = [];
  let inputValue = '';
  let isLoading = false;
  let sessionData = {};
  let chatContainer;
  
  onMount(async () => {
    if (browser) {
      // 강제로 레이아웃 고정 (실제 내용으로)
      messages = [{
        id: 0,
        content: '<div style="padding: 20px 0; color: #888;">Loading personalized message...</div>',
        sender: 'assistant',
        timestamp: new Date().toISOString()
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
    
    console.log('Initializing chat with session data:', sessionData);
    
    try {
      // 개인화된 초기 메시지 생성
      const initialMessage = await generatePersonalizedInitialMessage(sessionData);
      
      // 챗봇에 초기 메시지 설정
      addInitialMessageToChat(initialMessage);
      
    } catch (error) {
      console.error('Failed to generate personalized initial message:', error);
      
      // 폴백 메시지
      const fallbackMessage = `Hello! I'm here to discuss perspectives on gender roles and family structures. I understand this is an important topic for you, and I'd like to explore some evidence-based viewpoints together. What aspects of this topic would you like to discuss first?`;
      
      addInitialMessageToChat(fallbackMessage);
    }
  }

  // 개인화된 초기 메시지 생성
  async function generatePersonalizedInitialMessage(sessionData) {
    const response = await fetch('/api/gender_roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [],
        sessionData: sessionData,
        requestType: 'initial-challenge'
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.message;
  }

  // 챗봇에 초기 메시지 추가
  function addInitialMessageToChat(message) {
    const formattedMessage = formatAIMessage(message);
    
    // 기존 초기화 메시지를 교체
    messages = [
      {
        id: Date.now(),
        content: formattedMessage,
        sender: 'assistant',
        timestamp: new Date().toISOString()
      }
    ];
    
    console.log('Initial message added to chat:', message.substring(0, 100) + '...');
  }

  // AI 메시지 포맷팅 함수
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

  // 메시지 전송
  async function sendMessage() {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now(),
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    messages = [...messages, userMessage];
    inputValue = '';
    isLoading = true;
    
    // 스크롤을 아래로
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
    
    try {
      const response = await fetch('/api/gender_roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          sessionData: sessionData
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      const aiMessage = {
        id: Date.now() + 1,
        content: formatAIMessage(data.message),
        sender: 'assistant',
        timestamp: new Date().toISOString()
      };
      
      messages = [...messages, aiMessage];
      
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        content: "I'm sorry, I'm having trouble processing your message right now. Could you please try again?",
        sender: 'assistant',
        timestamp: new Date().toISOString()
      };
      
      messages = [...messages, errorMessage];
    } finally {
      isLoading = false;
      
      // 스크롤을 아래로
      setTimeout(() => {
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
    }
  }

  // 엔터키로 메시지 전송
  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
</script>

<svelte:head>
  <title>AI Research Chat</title>
</svelte:head>

<div class="chat-container">
  <div class="chat-header">
    <h3>Research Discussion</h3>
  </div>
  
  <div class="chat-messages" bind:this={chatContainer}>
    {#each messages as message (message.id)}
      <div class="message {message.sender}">
        <div class="message-content">
          {@html message.content}
        </div>
        <div class="message-time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
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
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
    width: 100%;
    box-sizing: border-box;
    min-height: 60px; /* 고정 높이 */
  }
  
  .chat-header h3 {
    margin: 0;
    color: #495057;
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