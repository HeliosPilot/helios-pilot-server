import handler from '../api/index';

const text = process.argv[2] || '/start';
const req = {
  method: 'POST',
  headers: {
    'x-telegram-bot-api-secret-token': 'local'
  },
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
  setHeader() { return this; },
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; console.log('INPUT:', text); console.log('STATUS:', this.statusCode); console.log('RESPONSE:', JSON.stringify(payload)); return this; },
  send(payload) { this.body = payload; console.log('INPUT:', text); console.log('STATUS:', this.statusCode); console.log('RESPONSE:', JSON.stringify(payload)); return this; }
};

process.env.TELEGRAM_CHAT_ID = '12345';
process.env.TELEGRAM_WEBHOOK_SECRET = 'local';
await handler(req, res);
