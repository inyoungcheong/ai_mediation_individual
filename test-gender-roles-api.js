#!/usr/bin/env node

// Gender Roles API 테스트 스크립트
const API_BASE_URL = 'http://localhost:5173/api/gender_roles';

async function testGetEndpoint() {
  console.log('🧪 Testing GET endpoint...');
  try {
    const response = await fetch(API_BASE_URL);
    const text = await response.text();
    console.log('✅ GET Response:', text);
    console.log('Status:', response.status);
  } catch (error) {
    console.error('❌ GET Error:', error.message);
  }
}

async function testPostEndpoint() {
  console.log('\n🧪 Testing POST endpoint (initial challenge)...');
  
  const testData = {
    sessionData: {
      topStatement: "Men should be the primary breadwinners in families",
      aiSummary: "User believes men are naturally better suited for leadership and financial responsibility",
      importanceLevel: "7",
      userReasoning: "This is how it's always been and it works well for society"
    },
    requestType: "initial-challenge"
  };

  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('✅ POST Response (initial challenge):');
    console.log('Status:', response.status);
    console.log('Message Type:', result.messageType);
    console.log('Message Length:', result.message?.length);
    console.log('Message Preview:', result.message?.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ POST Error:', error.message);
  }
}

async function testChatEndpoint() {
  console.log('\n🧪 Testing POST endpoint (chat)...');
  
  const testData = {
    messages: [
      {
        sender: 'user',
        content: 'I think women are naturally better at taking care of children than men.'
      }
    ],
    sessionData: {
      topStatement: "Women are naturally better caregivers",
      aiSummary: "User believes women have innate nurturing abilities",
      importanceLevel: "6",
      userReasoning: "It's biological and obvious from nature"
    },
    requestType: "chat"  // 명시적으로 chat 타입 지정
  };

  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('✅ POST Response (chat):');
    console.log('Status:', response.status);
    console.log('Message Length:', result.message?.length);
    console.log('Message Preview:', result.message?.substring(0, 200) + '...');
    if (result.error) {
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ POST Error:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Gender Roles API Tests\n');
  
  await testGetEndpoint();
  await testPostEndpoint();
  await testChatEndpoint();
  
  console.log('\n✨ Tests completed!');
}

// 스크립트 실행
runTests().catch(console.error);
