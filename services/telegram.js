import fetch from "node-fetch";

const GIF_DIR = "media/gifs";

export async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  const MAX_LENGTH = 4000;
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    const chunk = text.substring(i, i + MAX_LENGTH);
    try {
      const bodyData = {
        chat_id: chatId,
        text: chunk,
        parse_mode: "Markdown"
      };
      if (replyMarkup) {
        bodyData.reply_markup = replyMarkup;
      }

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });
    } catch (err) {
      console.error("Telegram Send Error:", err);
    }
  }
}

export async function sendTelegramGif(chatId, gifName, caption = "") {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  const gifPath = `${GIF_DIR}/${gifName}`;
  
  try {
    // Try sending as animation (JSON method)
    const bodyData = {
      chat_id: chatId,
      animation: gifPath,
    };
    if (caption) {
      bodyData.caption = caption;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendAnimation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData),
    });

    const data = await response.json();
    
    if (!response.ok || data.ok === false) {
      // If JSON method fails, try sending as document with mime type
      console.log("JSON method attempted, result:", data);
    }
    
    return data;
  } catch (err) {
    console.error("Telegram GIF Send Error:", err);
    return { ok: false, error: err.message };
  }
}

export async function answerTelegramCallback(callbackQueryId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !callbackQueryId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text }),
    });
  } catch (err) {
    console.error("Answer Callback Error:", err);
  }
}

export async function setTelegramMessageReaction(chatId, messageId, emoji = "⚡") {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || !messageId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/setMessageReaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reaction: [{ type: "emoji", emoji: emoji }]
      }),
    });
  } catch (err) {
    console.error("Reaction Error:", err);
  }
}