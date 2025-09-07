// Test script for the two_agent API
// This demonstrates the conversation flow: initial_message > user > emotional_agent > intelligent_agent > user...

const API_BASE_URL = 'http://localhost:5173/api/two_agent';

async function testTwoAgentAPI() {
  console.log('🧪 Testing Two Agent API...\n');
  
  try {
    // Test 1: Initial message
    console.log('1️⃣ Testing initial message...');
    const initialResponse = await fetch(`${API_BASE_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestType: 'initial-message',
        sessionData: {
          topStatement: 'gender roles in modern society',
          aiSummary: 'Believes traditional gender roles are important for family stability',
          importanceLevel: '7',
          userReasoning: 'Traditional roles provide clear structure and stability for children'
        }
      })
    });
    
    const initialData = await initialResponse.json();
    console.log('✅ Initial message:', initialData.message);
    console.log('📊 Conversation state:', initialData.conversationState);
    console.log('📝 Message type:', initialData.messageType);
    console.log('');
    
    // Test 2: User message -> Emotional agent response
    console.log('2️⃣ Testing user message -> emotional agent response...');
    const emotionalResponse = await fetch(`${API_BASE_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { sender: 'user', content: 'I think men should be the primary breadwinners and women should focus on raising children. This is how it has always been and it works well.' }
        ],
        sessionData: {
          topStatement: 'gender roles in modern society',
          aiSummary: 'Believes traditional gender roles are important for family stability',
          importanceLevel: '7',
          userReasoning: 'Traditional roles provide clear structure and stability for children'
        },
        conversationState: 'user_message'
      })
    });
    
    const emotionalData = await emotionalResponse.json();
    console.log('✅ Emotional agent response:', emotionalData.message);
    console.log('📊 Conversation state:', emotionalData.conversationState);
    console.log('📝 Message type:', emotionalData.messageType);
    console.log('');
    
    // Test 3: Emotional response -> Intelligent agent response
    console.log('3️⃣ Testing emotional response -> intelligent agent response...');
    const intelligentResponse = await fetch(`${API_BASE_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { sender: 'user', content: 'I think men should be the primary breadwinners and women should focus on raising children. This is how it has always been and it works well.' },
          { sender: 'assistant', content: emotionalData.message }
        ],
        sessionData: {
          topStatement: 'gender roles in modern society',
          aiSummary: 'Believes traditional gender roles are important for family stability',
          importanceLevel: '7',
          userReasoning: 'Traditional roles provide clear structure and stability for children'
        },
        conversationState: 'emotional_response'
      })
    });
    
    const intelligentData = await intelligentResponse.json();
    console.log('✅ Intelligent agent response:', intelligentData.message);
    console.log('📊 Conversation state:', intelligentData.conversationState);
    console.log('📝 Message type:', intelligentData.messageType);
    console.log('');
    
    // Test 4: Another user message -> Emotional agent response (cycle continues)
    console.log('4️⃣ Testing another user message -> emotional agent response...');
    const emotionalResponse2 = await fetch(`${API_BASE_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { sender: 'user', content: 'I think men should be the primary breadwinners and women should focus on raising children. This is how it has always been and it works well.' },
          { sender: 'assistant', content: emotionalData.message },
          { sender: 'assistant', content: intelligentData.message },
          { sender: 'user', content: 'But what about single mothers? They have to work and raise children at the same time.' }
        ],
        sessionData: {
          topStatement: 'gender roles in modern society',
          aiSummary: 'Believes traditional gender roles are important for family stability',
          importanceLevel: '7',
          userReasoning: 'Traditional roles provide clear structure and stability for children'
        },
        conversationState: 'user_message'
      })
    });
    
    const emotionalData2 = await emotionalResponse2.json();
    console.log('✅ Second emotional agent response:', emotionalData2.message);
    console.log('📊 Conversation state:', emotionalData2.conversationState);
    console.log('📝 Message type:', emotionalData2.messageType);
    console.log('');
    
    console.log('🎉 All tests completed successfully!');
    console.log('\n📋 Conversation Flow Summary:');
    console.log('1. Initial message (system)');
    console.log('2. User message');
    console.log('3. Emotional agent response');
    console.log('4. Intelligent agent response');
    console.log('5. User message (cycle continues...)');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testTwoAgentAPI();
