import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Princeton Azure OpenAI 설정
    const apiKey = env.OPENAI_API_KEY;
    const endpoint = 'https://api-ai-sandbox.princeton.edu/';
    const apiVersion = '2025-03-01-preview';
    const modelName = 'gpt-4o-mini';
    
    if (!apiKey) {
      console.error('OpenAI API key not found');
      return new Response('API key not configured', { status: 500 });
    }
    
    const reasoning = url.searchParams.get('reasoning');
    const statement = url.searchParams.get('statement');
    
    console.log('Processing reasoning:', reasoning);
    
    if (!reasoning || reasoning.trim() === '') {
      const fallbackHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <h3>No reasoning provided</h3>
    <p>Please go back and complete the previous question.</p>
</body>
</html>`;
      
      return new Response(fallbackHtml, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const messages = [
      {
        role: 'system',
        content: 'You are a skilled, empathetic researcher who summarizes people\'s viewpoints accurately and respectfully.'
      },
      {
        role: 'user', 
        content: `You are helping with a research study on gender role attitudes. A participant strongly agreed with this statement: "${statement}"

They provided this reasoning: "${reasoning}"

Please create a concise, empathetic summary of their main points that:
1. Acknowledges their perspective respectfully  
2. Captures their key reasoning in 2-3 sentences
3. Uses neutral, non-judgmental language
4. Shows you understand their viewpoint

Format as a direct summary without introduction.`
      }
    ];

    const requestData = {
      messages: messages,
      model: modelName,
      max_tokens: 150,
      temperature: 0.7
    };

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Princeton Azure OpenAI API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content?.trim() || "Unable to generate summary";

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>AI Summary</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            margin: 20px;
            line-height: 1.6;
        }
        .summary-container {
            background: #f8f9fa;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            margin: 20px 0;
        }
        .confirmation {
            margin: 20px 0;
        }
        label {
            display: block;
            margin: 10px 0;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            cursor: pointer;
            background: #fff;
        }
        label:hover {
            background: #f8f9fa;
            border-color: #007bff;
        }
        input[type="radio"] {
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <h3>Summary of Your Perspective</h3>
    
    <p>Thank you for sharing your thoughts. Based on what you wrote, we understand your main reasoning to be:</p>
    
    <div class="summary-container">
        <h4>Summary of your perspective:</h4>
        <p>${summary}</p>
    </div>
    
    <div class="confirmation">
        <p><strong>Does this summary accurately capture your main points?</strong></p>
        
        <label>
            <input type="radio" name="summary_confirmation" value="yes">
            Yes, this accurately represents my perspective
        </label>
        
        <label>
            <input type="radio" name="summary_confirmation" value="no">
            No, this doesn't capture my reasoning well
        </label>
        
        <label>
            <input type="radio" name="summary_confirmation" value="partial">
            Partially accurate, but missing some key points
        </label>
    </div>
    
    <script>
        document.querySelectorAll('input[name="summary_confirmation"]').forEach(radio => {
            radio.addEventListener('change', function() {
                window.parent.postMessage({
                    type: 'summary-confirmation',
                    value: this.value,
                    summary: '${summary.replace(/'/g, "\\'")}'
                }, '*');
            });
        });
        
        window.parent.postMessage({
            type: 'summary-ready',
            summary: '${summary.replace(/'/g, "\\'")}'
        }, '*');
    </script>
</body>
</html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Processing error:', error);
    
    const fallbackHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <h3>Processing Your Response</h3>
    <p>We are processing your response. Your perspective has been noted.</p>
    <script>
        window.parent.postMessage({
            type: 'summary-ready',
            summary: 'Processing response...'
        }, '*');
    </script>
</body>
</html>
    `;
    
    return new Response(fallbackHtml, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};