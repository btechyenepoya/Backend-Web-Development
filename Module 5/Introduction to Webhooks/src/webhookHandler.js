const crypto = require('node:crypto');
const { handleEvent } = require('./eventHandlers');

const _processedIds = new Set();

function verifySignature(rawBody, sigHeader, secret) {
  if (!sigHeader || typeof sigHeader !== 'string' || !secret) {
    return false;
  }

  const parts = sigHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }
  const receivedHex = parts[1];

  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const receivedBuf = Buffer.from(receivedHex, 'hex');

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

function handleWebhook(req, res) {
  const sigHeader = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  if (!verifySignature(req.body, sigHeader, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body);

  if (_processedIds.has(event.id)) {
    return res.status(200).json({ status: 'already_processed' });
  }

  _processedIds.add(event.id);

  res.status(200).json({ status: 'received' });

  setImmediate(() => {
    handleEvent(event);
  });
}

module.exports = {
  handleWebhook,
  _processedIds,
};