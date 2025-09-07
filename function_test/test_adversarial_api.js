// Test script for the adversarial reconciliation API
const testAdversarialAPI = async () => {
  const baseUrl = 'http://localhost:5173'; // Adjust port if needed
  
  try {
    // Test GET endpoint
    console.log('Testing GET endpoint...');
    const getResponse = await fetch(`${baseUrl}/api/adversarial_reconciliation`);
    const getData = await getResponse.text();
    console.log('GET Response:', getData);
    
    // Test initial message
    console.log('\nTesting initial message...');
    const initialMessageResponse = await fetch(`${baseUrl}/api/adversarial_reconciliation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestType: 'initial-message',
        sessionData: {
          topStatement: 'Climate change is the most pressing issue of our time',
          aiSummary: 'The user believes climate change requires immediate action',
          importanceLevel: '8',
          userReasoning: 'Based on scientific evidence and environmental concerns'
        }
      })
    });
    
    const initialData = await initialMessageResponse.json();
    console.log('Initial Message Response:', initialData);
    
    // Test adversarial agent response
    console.log('\nTesting adversarial agent response...');
    const adversarialResponse = await fetch(`${baseUrl}/api/adversarial_reconciliation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { sender: 'user', content: 'I think we need to take immediate action on climate change' }
        ],
        sessionData: {
          topStatement: 'Climate change is the most pressing issue of our time',
          aiSummary: 'The user believes climate change requires immediate action',
          importanceLevel: '8',
          userReasoning: 'Based on scientific evidence and environmental concerns'
        },
        conversationState: 'user_message'
      })
    });
    
    const adversarialData = await adversarialResponse.json();
    console.log('Adversarial Agent Response:', adversarialData);
    
    // Test reconciliation agent response
    console.log('\nTesting reconciliation agent response...');
    const reconciliationResponse = await fetch(`${baseUrl}/api/adversarial_reconciliation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { sender: 'user', content: 'I think we need to take immediate action on climate change' },
          { sender: 'assistant', content: '@adversarial: I understand your concern, but I think there are other pressing issues that deserve equal attention...' }
        ],
        sessionData: {
          topStatement: 'Climate change is the most pressing issue of our time',
          aiSummary: 'The user believes climate change requires immediate action',
          importanceLevel: '8',
          userReasoning: 'Based on scientific evidence and environmental concerns'
        },
        conversationState: 'adversarial_response'
      })
    });
    
    const reconciliationData = await reconciliationResponse.json();
    console.log('Reconciliation Agent Response:', reconciliationData);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Run the test
testAdversarialAPI();
