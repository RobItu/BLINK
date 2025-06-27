// BLINK Backend with Circle Integration
// This server handles Circle deposit address creation, merchant management, and WebSocket notifications
// Circle functions documentation: https://developers.circle.com/circle-mint/

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Storage
const merchants = new Map();

// Circle API configuration
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;
const CIRCLE_BASE_URL = 'https://api-sandbox.circle.com/v1';
let CHAIN = 'AVAX'; // Default chain, can be overridden in requests

// ==========================================
// Websocket Setup
// ==========================================

const WebSocket = require('ws');
const http = require('http');

// After your app setup, before the routes, add:
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store merchant connections
const merchantConnections = new Map();

// Add this to your WebSocket connection handler
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const merchantId = url.searchParams.get('merchantId');
  
  if (merchantId) {
    merchantConnections.set(merchantId, ws);
    console.log(`📱 Merchant ${merchantId} connected via WebSocket`);
    
    // Send ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        // console.log(`🏓 Ping sent to ${merchantId}`);
        console.log(``);
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
    
    // Handle pong responses
    ws.on('pong', () => {
      // console.log(`🏓 Pong received from ${merchantId}`);
      console.log(` `);
    });
    
    ws.on('close', () => {
      clearInterval(pingInterval);
      merchantConnections.delete(merchantId);
      console.log(`📱 Merchant ${merchantId} disconnected`);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for ${merchantId}:`, error);
      clearInterval(pingInterval);
      merchantConnections.delete(merchantId);
    });
  }
});

setInterval(() => {
  console.log('Monitoring...');
  
  for (const [merchantId, ws] of merchantConnections.entries()) {
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      console.log(`🗑️ Removing dead connection for ${merchantId}`);
      merchantConnections.delete(merchantId);
    }
  }
  
  console.log(`💡 Active connections: ${merchantConnections.size}`);
}, 60000);


// ==========================================
// CIRCLE API HELPER FUNCTIONS
// ==========================================

//generate a unique idempotency key
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Notify merchant via WebSocket for USDC transfers
async function notifyMerchantUSDC(merchantId, notificationData) {
  console.log(`📱 Notifying merchant ${merchantId} for USDC:`, notificationData);
  
  // Try exact match first, then lowercase match
  let ws = merchantConnections.get(merchantId);
  if (!ws) {
    ws = merchantConnections.get(merchantId.toLowerCase());
  }
  
  // If still not found, try to find case-insensitive match
  if (!ws) {
    for (const [storedAddress, connection] of merchantConnections) {
      if (storedAddress.toLowerCase() === merchantId.toLowerCase()) {
        ws = connection;
        break;
      }
    }
  }
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'usdc_received',
      ...notificationData
    }));
    console.log(`✅ USDC WebSocket notification sent to ${merchantId}`);
  } else {
    console.log(`⚠️ No active WebSocket connection for USDC merchant ${merchantId}`);
    console.log(`Active connections:`, Array.from(merchantConnections.keys()));
    console.log(`WebSocket state:`, ws ? ws.readyState : 'No WebSocket found');
  }
}

async function notifyMerchant(merchantId, notificationData) {
  console.log(`📱 Notifying merchant ${merchantId}:`, notificationData);
  
  const ws = merchantConnections.get(merchantId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'payment_received',
      ...notificationData
    }));
    console.log(`✅ WebSocket notification sent to ${merchantId}`);
  } else {
    console.log(`⚠️ No active WebSocket connection for merchant ${merchantId}`);
  }
}

// Add this helper function after your other Circle API functions
async function getExistingDepositAddresses() {
  try {
    console.log('🔍 Checking existing Circle deposit addresses...');
    
    const response = await fetch(`${CIRCLE_BASE_URL}/businessAccount/wallets/addresses/deposit`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Circle API Error:', errorData);
      throw new Error(`Circle API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Existing deposit addresses:', data);
    return data.data || [];
    
  } catch (error) {
    console.error('❌ Failed to get existing deposit addresses:', error);
    return [];
  }
}

async function createDepositAddress(currency = 'USD', chain = CHAIN) {
  try {
    console.log(`🏗️ Creating deposit address for ${currency} on ${chain}...`);
    
    // Generate unique idempotency key
    const idempotencyKey = generateUUID();
    
    // Use dynamic import for node-fetch if built-in fetch fails
    let fetchFunction = fetch;
    if (typeof fetch === 'undefined') {
      const { default: nodeFetch } = await import('node-fetch');
      fetchFunction = nodeFetch;
    }
    
    const response = await fetchFunction(`${CIRCLE_BASE_URL}/businessAccount/wallets/addresses/deposit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotencyKey: idempotencyKey,
        currency: currency,
        chain: chain
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Circle API Error:', errorData);
      throw new Error(`Circle API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Deposit address created:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Failed to create deposit address:', error);
    throw error;
  }
}

// ==========================================
// API ENDPOINTS
// ==========================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date(),
    message: 'BLINK Backend with Circle Integration running!'
  });
});

// QR USDC Notification
app.post('/webhook/usdc-transfer', (req, res) => {
  console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));
  
  try {
    const { event } = req.body;
    const network = event.network;
    const activities = event.activity;
    
    console.log(`Processing ${activities.length} activities on ${network}`);
    
activities.forEach(activity => {
  if (activity.asset === 'USDC' && activity.category === 'token') {
    const fromAddress = activity.fromAddress;
    let toAddress = activity.toAddress;
    
    const connections = Array.from(merchantConnections.keys());
    const matchingConnection = connections.find(addr => 
      addr.toLowerCase() === toAddress.toLowerCase()
    );
    
    if (matchingConnection) {
      toAddress = matchingConnection; // Use the exact case from the connection
    }
    
    const amount = activity.value;
    const hash = activity.hash;
    
    console.log(`💰 USDC received: ${amount} USDC to ${toAddress} from ${fromAddress}`);
    
    notifyMerchantUSDC(toAddress, {
      status: 'complete',
      amount: amount.toString(),
      currency: 'USDC',
      network: network,
      transactionHash: hash,
      fromAddress: fromAddress
    });
  }
});
    
  } catch (error) {
    console.error('Webhook processing error:', error);
  }
  
  res.status(200).send('OK');
});
// Setup Circle deposit address
app.post('/api/merchants/:merchantId/setup-circle', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { chain = 'AVAX' } = req.body;
    
    console.log(`🚀 Setting up Circle for merchant: ${merchantId} on chain: ${chain}`);
    
    // Validate chain
    const validChains = ['ALGO', 'APTOS', 'ARB', 'AVAX', 'BASE', 'BTC', 'CELO', 'ETH', 'HBAR', 'LINEA', 'NEAR', 'NOBLE', 'OP', 'PAH', 'POLY', 'SOL', 'SUI', 'UNI', 'XLM', 'XRP', 'ZKS'];
    if (!validChains.includes(chain)) {
      return res.status(400).json({
        success: false,
        error: `Invalid chain. Supported chains: ${validChains.join(', ')}`
      });
    }
    
    // Check existing Circle deposit addresses first
    const existingAddresses = await getExistingDepositAddresses();
    const existingAddress = existingAddresses.find(addr => addr.chain === chain && addr.currency === 'USD');
    
    if (existingAddress) {
      console.log(`✅ Found existing deposit address for ${chain}: ${existingAddress.address}`);
      
      // Store/update merchant data with existing address
      let merchant = merchants.get(merchantId);
      if (!merchant) {
        merchant = {
          id: merchantId,
          depositId: existingAddress.id,
          depositAddress: existingAddress.address,
          currency: existingAddress.currency,
          chain: existingAddress.chain,
          fiatEnabled: true,
          createdAt: new Date()
        };
      } else {
        merchant.depositId = existingAddress.id;
        merchant.depositAddress = existingAddress.address;
        merchant.currency = existingAddress.currency;
        merchant.chain = existingAddress.chain;
        merchant.fiatEnabled = true;
      }
      
      merchants.set(merchantId, merchant);
      
      return res.json({
        success: true,
        message: 'Using existing Circle deposit address',
        depositAddress: existingAddress.address,
        chain: existingAddress.chain,
        currency: existingAddress.currency,
        depositId: existingAddress.id,
        note: 'This is Circle SANDBOX - using existing address'
      });
    }
    
    // If no existing address, create new one
    console.log(`📝 No existing address found for ${chain}, creating new one...`);
    const circleResponse = await createDepositAddress('USD', chain);
    
    if (!circleResponse.data) {
      throw new Error('Invalid response from Circle API');
    }
    
    const { id, address, currency, chain: responseChain } = circleResponse.data;
    
    // Store merchant data
    let merchant = merchants.get(merchantId);
    if (!merchant) {
      merchant = {
        id: merchantId,
        depositId: id,
        depositAddress: address,
        currency: currency,
        chain: responseChain,
        fiatEnabled: true,
        createdAt: new Date()
      };
    } else {
      merchant.depositId = id;
      merchant.depositAddress = address;
      merchant.currency = currency;
      merchant.chain = responseChain;
      merchant.fiatEnabled = true;
    }
    
    merchants.set(merchantId, merchant);
    
    console.log(`✅ Circle setup complete for merchant ${merchantId}`);
    console.log(`📍 Deposit Address: ${address}`);
    console.log(`⛓️ Chain: ${responseChain}`);
    
    res.json({
      success: true,
      message: 'Circle deposit address created successfully',
      depositAddress: address,
      chain: responseChain,
      currency: currency,
      depositId: id,
      note: 'This is Circle SANDBOX - new address created'
    });
    
  } catch (error) {
    console.error('❌ Circle setup failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to create Circle deposit address'
    });
  }
});

// Get Circle account balances
app.get('/api/circle/balances', async (req, res) => {
  try {
    console.log('💰 Fetching Circle account balances...');
    
    const response = await fetch(`${CIRCLE_BASE_URL}/businessAccount/balances`, {
      headers: {
        'Authorization': `Bearer ${CIRCLE_API_KEY}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Circle API Error:', errorData);
      throw new Error(`Circle API Error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Account balances:', JSON.stringify(data, null, 2));
    
    // Check for any USD balances
    const available = data.data?.available || [];
    const unsettled = data.data?.unsettled || [];
    
    const usdcBalance = available.find(b => b.currency === 'USD');
    const pendingBalance = unsettled.find(b => b.currency === 'USD');
    
    res.json({
      success: true,
      balances: data.data,
      summary: {
        usdcAvailable: usdcBalance?.amount || '0.00',
        usdcPending: pendingBalance?.amount || '0.00',
        totalBalances: available.length,
        hasPendingTransactions: unsettled.length > 0
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch balances:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get transaction history
app.get('/api/circle/transactions', async (req, res) => {
  try {
    console.log('📋 Fetching transaction history...');
    
    const response = await fetch(`${CIRCLE_BASE_URL}/businessAccount/transfers`, {
      headers: {
        'Authorization': `Bearer ${CIRCLE_API_KEY}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Circle API Error:', errorData);
      throw new Error(`Circle API Error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Transaction history:', data);
    
    res.json({
      success: true,
      transactions: data.data
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all deposit addresses
app.get('/api/circle/deposit-addresses', async (req, res) => {
  try {
    console.log('📋 Fetching all deposit addresses...');
    
    const response = await fetch(`${CIRCLE_BASE_URL}/businessAccount/wallets/addresses/deposit`, {
      headers: {
        'authorization': `Bearer ${CIRCLE_API_KEY}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Circle API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.json({
      success: true,
      addresses: data.data || []
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch deposit addresses:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/test/create-bank', async (req, res) => {
  try {
    console.log('🧪 Creating bank account with user details...');
    
    const { bankDetails, merchantId } = req.body; // Add merchantId to request
    
    if (!bankDetails || !merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Bank details and merchant ID are required'
      });
    }
    
    const url = 'https://api-sandbox.circle.com/v1/businessAccount/banks/wires';
    const options = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bankAddress: bankDetails.bankAddress,
        billingDetails: bankDetails.billingDetails,
        routingNumber: bankDetails.routingNumber,
        accountNumber: bankDetails.accountNumber,
        idempotencyKey: generateUUID()
      })
    };
    
    const response = await fetch(url, options);
    const json = await response.json();
    
    if (json.data?.id) {
      // Store bank ID in merchants Map immediately
      let merchant = merchants.get(merchantId);
      if (!merchant) {
        merchant = {
          id: merchantId,
          bankAccountId: json.data.id,
          createdAt: new Date()
        };
      } else {
        merchant.bankAccountId = json.data.id;
      }
      
      merchants.set(merchantId, merchant);
      
      console.log('✅ Bank account created and ID stored:', json.data.id);
      console.log('✅ Merchant updated with bank ID:', merchantId);
      
      res.json({
        success: true,
        circleResponse: json,
        bankAccountId: json.data.id,
        message: 'Bank account created and linked successfully'
      });
    } else {
      console.error('❌ No bank ID in Circle response:', json);
      res.status(500).json({
        success: false,
        error: 'Failed to create bank account',
        circleResponse: json
      });
    }
    
  } catch (error) {
    console.error('❌ Bank creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test payout creation (direct Circle call)
app.post('/api/test/create-payout', async (req, res) => {
  try {
    console.log('💸 Testing direct payout creation...');
    
    const url = 'https://api-sandbox.circle.com/v1/businessAccount/payouts';
    const options = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotencyKey: 'ba943ff1-ca16-49b2-ba55-1057e70ca5c7',
        destination: {type: 'wire', id: '227790f2-7acb-48ae-b043-e4b128612a9f'},
        amount: {amount: '1.00', currency: 'USD'}
      })
    };
    
    const response = await fetch(url, options);
    const json = await response.json();
    
    console.log('✅ Direct Circle payout response:', json);
    
    res.json({
      success: true,
      circleResponse: json
    });
    
  } catch (error) {
    console.error('❌ Payout test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test check payout status (direct Circle call)
app.get('/api/test/check-payout-status', async (req, res) => {
  try {
    console.log('🔍 Checking payout status...');
    
    const url = 'https://api-sandbox.circle.com/v1/businessAccount/payouts/33e66fb6-059e-4a73-95c0-6093429ff227';
    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };
    
    const response = await fetch(url, options);
    const json = await response.json();
    
    console.log('✅ Payout status response:', json);
    
    res.json({
      success: true,
      circleResponse: json
    });
    
  } catch (error) {
    console.error('❌ Status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add this to your backend
// Add this BEFORE your webhook route
app.use('/api/webhooks/circle', express.text({ type: 'text/plain' }));

app.post('/api/webhooks/circle', async (req, res) => {
  try {
    const messageType = req.headers['x-amz-sns-message-type'];
    
    if (messageType === 'SubscriptionConfirmation') {
      res.status(200).send('OK');
      return;
    }
    
    if (messageType === 'Notification') {
      // Parse the SNS notification
      const snsMessage = JSON.parse(req.body);
      
      // Parse the Circle data from the Message field
      const circleData = JSON.parse(snsMessage.Message);
      
      console.log('📨 Circle webhook received:', circleData);
      
      // Extract transfer data from Circle notification
      if (circleData.notificationType === 'transfers' && circleData.transfer) {
        const transfer = circleData.transfer;
        
        // Check if this is a deposit (incoming transfer from blockchain)
        if (transfer.source && transfer.source.type === 'blockchain') {
          console.log('💰 USDC deposit detected!');
          console.log(`Amount: ${transfer.amount.amount} ${transfer.amount.currency}`);
          console.log(`To address: ${transfer.destination.address}`);
          console.log(`Status: ${transfer.status}`);
          
          // Find which merchant this belongs to
          const merchant = findMerchantByDepositAddress(transfer.destination.address);
          
          if (merchant) {
            console.log(`✅ Deposit for merchant: ${merchant.id}`);
            
            // Notify the merchant via WebSocket
            await notifyMerchant(merchant.id, {
              type: 'deposit_received',
              amount: transfer.amount.amount,
              currency: transfer.amount.currency,
              status: transfer.status,
              transactionHash: transfer.transactionHash,
              sourceChain: transfer.source.chain,
              timestamp: transfer.createDate
            });
            
            // If status is 'complete', trigger payout
            if (transfer.status === 'complete') {
              await triggerAutomaticPayout(merchant, transfer.amount.amount);
            }
          } else {
            console.log('⚠️ No merchant found for deposit address:', transfer.destination.address);
          }
        }
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(200).send('OK'); // Always return 200 to SNS
  }
});

// // Use this to handle Circle webhooks and confirming subscriptions
// app.use('/api/webhooks/circle', express.text({ type: 'text/plain' }));

// app.post('/api/webhooks/circle', async (req, res) => {
//   try {
//     console.log('📨 Raw request body:', req.body);
//     console.log('📨 Message type:', req.headers['x-amz-sns-message-type']);
    
//     if (req.headers['x-amz-sns-message-type'] === 'SubscriptionConfirmation') {
//       const message = JSON.parse(req.body);
//       console.log('🔗 Subscription URL:', message.SubscribeURL);
      
//       // You need to visit this URL to confirm the subscription
//       // Or make a GET request to it programmatically
      
//       res.status(200).send('OK');
//     } else {
//       // Handle normal webhook data
//       const data = JSON.parse(req.body);
//       console.log('📨 Circle webhook:', data);
//       res.status(200).json({ received: true });
//     }
//   } catch (error) {
//     console.error('❌ Webhook error:', error);
//     res.status(200).send('OK'); // Always return 200 to SNS
//   }
// });

// Helper function to find merchant by deposit address
function findMerchantByDepositAddress(address) {
  for (const [merchantId, merchant] of merchants.entries()) {
    if (merchant.depositAddress === address) {
      return merchant;
    }
  }
  return null;
}

// Function to trigger automatic payout
async function triggerAutomaticPayout(merchant, amount) {
  try {
    console.log(`💸 Triggering automatic payout for merchant ${merchant.id}`);
    console.log(`bankAccountId: ${merchant.bankAccountId}, amount: ${amount}`);
    
    // Use your existing payout logic
    const response = await fetch('https://api-sandbox.circle.com/v1/businessAccount/payouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotencyKey: generateUUID(),
        destination: { type: 'wire', id: merchant.bankAccountId },
        amount: { amount: amount, currency: 'USD' }
      })
    });
    
    const data = await response.json();
    console.log('✅ Automatic payout initiated:', data);
    
  } catch (error) {
    console.error('❌ Automatic payout failed:', error);
  }
}

// ==========================================
// ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
  console.error('💥 Server Error:', err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3000; // Fixed to 3000

server.listen(PORT, () => {
  console.log('🚀 BLINK Backend with Circle Integration started!');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Circle API Key: ${CIRCLE_API_KEY ? 'Set ✅' : 'Missing ❌'}`);
  console.log('💰 Ready to create Circle deposit addresses...');
});

module.exports = app;