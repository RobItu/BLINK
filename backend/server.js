// server.js - Cleaned BLINK Backend with Circle Integration
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
let CHAIN = 'AVAX';



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

// Test bank account creation (direct Circle call)
app.post('/api/test/create-bank', async (req, res) => {
  try {
    console.log('🧪 Creating bank account with user details...');
    
    const { bankDetails } = req.body; // Get bank details from request
    
    if (!bankDetails) {
      return res.status(400).json({
        success: false,
        error: 'Bank details are required'
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
        bankAddress: bankDetails.bankAddress,          // Use user data
        billingDetails: bankDetails.billingDetails,    // Use user data
        routingNumber: bankDetails.routingNumber,      // Use user data
        accountNumber: bankDetails.accountNumber,      // Use user data
        idempotencyKey: generateUUID()                 // Generate random UUID
      })
    };
    
    const response = await fetch(url, options);
    const json = await response.json();
    
    console.log('✅ Bank account created with user details:', json);
    
    res.json({
      success: true,
      circleResponse: json
    });
    
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

app.listen(PORT, () => {
  console.log('🚀 BLINK Backend with Circle Integration started!');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Circle API Key: ${CIRCLE_API_KEY ? 'Set ✅' : 'Missing ❌'}`);
  console.log('💰 Ready to create Circle deposit addresses...');
});

module.exports = app;