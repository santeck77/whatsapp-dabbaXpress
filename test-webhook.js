// Test script to verify webhook is working
import fetch from 'node-fetch';

const testWebhook = async () => {
  const webhookUrl = 'https://whatsapp-dabba-xpress-pfjr.vercel.app/webhook';
  
  // Test GET request (verification)
  console.log('Testing GET /webhook (verification)...');
  try {
    const getResponse = await fetch(`${webhookUrl}?hub.mode=subscribe&hub.verify_token=19JU23NF394R6HH&hub.challenge=test123`);
    const getText = await getResponse.text();
    console.log('GET Response:', getResponse.status, getText);
  } catch (error) {
    console.error('GET Error:', error);
  }

  // Test POST request (message simulation)
  console.log('\nTesting POST /webhook (message simulation)...');
  const testMessage = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '1291710178999077',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '15551605262',
            phone_number_id: '714448665094548'
          },
          contacts: [{
            profile: {
              name: 'Test User'
            },
            wa_id: '15551605262'
          }],
          messages: [{
            from: '15551605262',
            id: 'wamid.test123',
            timestamp: '1640995200',
            text: {
              body: 'hi'
            },
            type: 'text'
          }]
        },
        field: 'messages'
      }]
    }]
  };

  try {
    const postResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage)
    });
    console.log('POST Response:', postResponse.status);
    const postText = await postResponse.text();
    console.log('POST Response Body:', postText);
  } catch (error) {
    console.error('POST Error:', error);
  }
};

testWebhook();
