// 중복 실행 방지 플래그
if (typeof window.chatbotLoaded === 'undefined') {
  window.chatbotLoaded = false;
}

// 이미 로드되었으면 실행하지 않음
if (window.chatbotLoaded) {
  console.log('Chatbot already loaded, skipping...');
} else {
  window.chatbotLoaded = true;
  
  // Get Embedded Data from Qualtrics (문자열 처리 안전하게)
  var topStatement = "${e://Field/TopStatement}";
  var aiSummary = "${e://Field/AISummary}";
  var importanceLevel = "${e://Field/ImportanceLevel}";
  var userReasoning = "${e://Field/UserReasoning}";
  
  // 초기화 함수 실행
  initializeChatbot();
}

function initializeChatbot() {
  // Console log for debugging
  console.log('Qualtrics Embedded Data:', {
    topStatement: topStatement,
    aiSummary: aiSummary,
    importanceLevel: importanceLevel,
    userReasoning: userReasoning
  });

  // Update debug information display (if exists)
  updateDebugInfo();
  
  // Create chatbot iframe only once
  createChatbotIframe();
}

function updateDebugInfo() {
  var debugStatement = document.getElementById('debug-statement');
  var debugImportance = document.getElementById('debug-importance');
  var debugSummary = document.getElementById('debug-summary');
  var debugReasoning = document.getElementById('debug-reasoning');
  
  if (debugStatement) debugStatement.textContent = topStatement || 'Not set';
  if (debugImportance) debugImportance.textContent = importanceLevel || 'Not set';
  if (debugSummary) debugSummary.textContent = aiSummary ? (aiSummary.substring(0, 100) + '...') : 'Not set';
  if (debugReasoning) debugReasoning.textContent = userReasoning ? (userReasoning.substring(0, 100) + '...') : 'Not set';
}

function createChatbotIframe() {
  var container = document.getElementById('chatbot-container');
  if (!container) {
    console.error('Chatbot container not found');
    return;
  }
  
  // 기존 iframe이 있다면 제거하지 않고 리턴
  if (container.querySelector('iframe')) {
    console.log('Iframe already exists, skipping creation');
    return;
  }
  
  try {
    // URL 파라미터 안전하게 처리
    var params = [];
    if (topStatement) params.push('topStatement=' + encodeURIComponent(topStatement));
    if (aiSummary) params.push('aiSummary=' + encodeURIComponent(aiSummary));
    if (importanceLevel) params.push('importanceLevel=' + encodeURIComponent(importanceLevel));
    if (userReasoning) params.push('userReasoning=' + encodeURIComponent(userReasoning));

    // Build the embed URL with parameters
    var embedUrl = 'https://ai-mediation-individual.vercel.app/two-agent-embed' + (params.length > 0 ? '?' + params.join('&') : '');
    
    console.log('Chatbot URL:', embedUrl);

    // Create iframe
    var iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    iframe.style.backgroundColor = 'white';
    iframe.style.display = 'block';
    iframe.style.margin = '0 auto';
    iframe.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';

    // Handle iframe loading
    iframe.onload = function() {
      console.log('Chatbot loaded successfully!');
      // 로딩 텍스트 제거
      var loadingElements = container.querySelectorAll('div, p');
      for (var i = 0; i < loadingElements.length; i++) {
        if (loadingElements[i].textContent && loadingElements[i].textContent.includes('Loading')) {
          loadingElements[i].remove();
        }
      }
    };

    iframe.onerror = function() {
      console.error('Failed to load chatbot');
      container.innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: red;">' +
        '<p>Unable to load chatbot. Please refresh the page.</p>' +
        '</div>';
    };

    // Clear container and add iframe
    container.innerHTML = '';
    container.appendChild(iframe);
    
  } catch (error) {
    console.error('Error creating chatbot iframe:', error);
    container.innerHTML = 
      '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: red;">' +
      '<p>Error loading chatbot. Please refresh the page.</p>' +
      '</div>';
  }
}

// Optional: Hide debug info after 10 seconds
setTimeout(function() {
  var debugDiv = document.getElementById('debug-info');
  if (debugDiv) {
    debugDiv.style.display = 'none';
  }
}, 10000);

// Utility functions
function generateEmbedUrl(customParams) {
  var params = [];
  
  // 기본값 설정
  var defaultParams = {
    topStatement: topStatement || '',
    aiSummary: aiSummary || '',
    importanceLevel: importanceLevel || 'medium',
    userReasoning: userReasoning || ''
  };
  
  // 커스텀 파라미터와 병합
  var finalParams = {};
  for (var key in defaultParams) {
    finalParams[key] = defaultParams[key];
  }
  if (customParams) {
    for (var key in customParams) {
      finalParams[key] = customParams[key];
    }
  }
  
  // 파라미터 추가
  for (var key in finalParams) {
    if (finalParams.hasOwnProperty(key) && finalParams[key]) {
      params.push(key + '=' + encodeURIComponent(finalParams[key]));
    }
  }
  
  return 'https://ai-mediation-individual.vercel.app/two-agent-embed' + (params.length > 0 ? '?' + params.join('&') : '');
}

// 채팅 인터페이스 새로고침 함수
function refreshChat() {
  var container = document.getElementById('chatbot-container');
  if (container) {
    container.innerHTML = '';
    createChatbotIframe();
  }
}

// 채팅 인터페이스 파라미터 업데이트 함수
function updateChatParams(newParams) {
  if (newParams.topStatement) topStatement = newParams.topStatement;
  if (newParams.aiSummary) aiSummary = newParams.aiSummary;
  if (newParams.importanceLevel) importanceLevel = newParams.importanceLevel;
  if (newParams.userReasoning) userReasoning = newParams.userReasoning;
  
  // 채팅 인터페이스 새로고침
  refreshChat();
}
