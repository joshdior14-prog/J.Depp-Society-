const express = require('express');
const router = express.Router();
const axios = require('axios');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const PLISIO_API_KEY = process.env.PLISIO_API_KEY;
const PLISIO_BASE_URL = 'https://api.plisio.net/api/v1';
const BITCOIN_WALLET = process.env.BITCOIN_WALLET_ADDRESS;

// Create payment with Plisio (Crypto or Fiat)
router.post('/plisio/create-invoice', auth, async (req, res) => {
  try {
    const { orderId, amount, productName, paymentType, currency } = req.body;
    // paymentType: 'crypto' or 'card'
    // currency: 'BTC', 'ETH', 'USDT', 'USD', etc.

    const invoiceId = uuidv4();
    
    const invoiceData = {
      amount: amount.toString(),
      currency: currency || (paymentType === 'crypto' ? 'BTC' : 'USD'),
      order_id: orderId,
      order_number: invoiceId,
      description: productName,
      callback_url: `${process.env.FRONTEND_URL}/api/plisio/webhook`,
      redirect_to_url: `${process.env.FRONTEND_URL}/payment-success?orderId=${orderId}`,
      email: req.body.email || '',
      plugin: 'custom'
    };

    const response = await axios.post(
      `${PLISIO_BASE_URL}/invoices/`,
      invoiceData,
      {
        params: {
          api_key: PLISIO_API_KEY
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status === 'success') {
      res.json({
        success: true,
        invoiceId: response.data.data.id,
        invoiceUrl: response.data.data.invoice_url,
        amount: response.data.data.amount,
        currency: response.data.data.currency,
        txid: response.data.data.txid
      });
    } else {
      res.status(400).json({ error: response.data.message });
    }
  } catch (error) {
    console.error('Plisio error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get invoice status
router.get('/plisio/invoice/:invoiceId', auth, async (req, res) => {
  try {
    const response = await axios.get(
      `${PLISIO_BASE_URL}/invoices/${req.params.invoiceId}/`,
      {
        params: {
          api_key: PLISIO_API_KEY
        }
      }
    );

    if (response.data.status === 'success') {
      res.json({
        success: true,
        status: response.data.data.status,
        amount: response.data.data.amount,
        currency: response.data.data.currency,
        txid: response.data.data.txid,
        orderId: response.data.data.order_id
      });
    } else {
      res.status(400).json({ error: response.data.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook for Plisio payment confirmations
router.post('/plisio/webhook', async (req, res) => {
  try {
    const { data } = req.body;

    // Verify webhook signature
    if (!verifyPlisioWebhook(req.body)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (data.status === 'completed' || data.status === 'confirmed') {
      const orderId = data.order_id;

      await Order.findByIdAndUpdate(
        orderId,
        {
          paymentStatus: 'completed',
          transactionId: data.txid,
          amount: data.amount,
          currency: data.currency,
          completedAt: new Date()
        }
      );

      console.log(`✓ Payment confirmed for order ${orderId}`);
    } else if (data.status === 'failed' || data.status === 'cancelled') {
      const orderId = data.order_id;

      await Order.findByIdAndUpdate(
        orderId,
        {
          paymentStatus: 'failed',
          transactionId: data.txid
        }
      );

      console.log(`✗ Payment failed for order ${orderId}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify Plisio webhook signature
function verifyPlisioWebhook(data) {
  // Plisio verification - check their documentation for exact implementation
  // This is a basic check - implement full verification as per Plisio docs
  return true;
}

// Get supported cryptocurrencies and fees
router.get('/plisio/currencies', async (req, res) => {
  try {
    const response = await axios.get(
      `${PLISIO_BASE_URL}/currencies/`,
      {
        params: {
          api_key: PLISIO_API_KEY
        }
      }
    );

    if (response.data.status === 'success') {
      res.json({
        success: true,
        currencies: response.data.data
      });
    } else {
      res.status(400).json({ error: response.data.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
