import handler from '../api/index.js';

const text = process.argv[2] || '/start';
const req = {
  method: 'POST',
  body: {
    message: {
      chat: { id: 12345 },
      text,
      message_id: 1
    }
  }
};

const res = {
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; console.log('INPUT:', text); console.log('STATUS:', this.statusCode); console.log('RESPONSE:', JSON.stringify(payload)); return this; }
};

process.env.TELEGRAM_CHAT_ID = '12345';
await handler(req, res);
