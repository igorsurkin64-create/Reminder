// Vercel Serverless Function: AI Vision Handwriting & Printed List Scanner
// Reads photos with any handwriting via Google Gemini Vision without exposing keys to users

module.exports = async (req, res) => {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
    if (!imageBase64) {
      res.status(400).json({ error: 'Изображение не получено' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Серверный ключ GEMINI_API_KEY не задан в Environment Variables на Vercel' });
      return;
    }

    const prompt = `Внимательно прочитай эту рукописную или напечатанную записку списка покупок или чек.
Почерк может быть сложным, неразборчивым или беглым — используй логику продуктового супермаркета, чтобы понять слова (например "колб." -> "Колбаса", "молочк." -> "Молоко").
Если пункт зачёркнут ручкой — пропусти его (он уже куплен).
Нормализуй падеж в именительный (например "сметаны" -> "Сметана", "колбасу" -> "Колбаса").
Отдели количество (например "1 кг", "300 г", "2 шт", "1 пачка"), если оно указано.
Если рядом с товаром указана цена (например "120 р", "250", "99"), запиши её числом в поле "price" (например 120), иначе null.

Верни ТОЛЬКО валидный JSON массив объектов:
[
  {
    "title": "Колбаса докторская",
    "quantity": "500 г",
    "price": 350,
    "category": "meat"
  }
]
Категории (category) строго: dairy, produce, meat, bakery, grocery, drinks, sweets, household, other.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    const body = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json'
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const code = errJson.error?.code;
      let msg = errJson.error?.message || `Ошибка API Gemini (${response.status})`;
      if (code === 402 || errJson.error?.status === 'RESOURCE_EXHAUSTED') {
        msg = 'У ключа Google AI исчерпан баланс (ошибка 402). Нужен бесплатный ключ без привязки к платному биллингу (Google AI Studio -> Create API key).';
      }
      res.status(502).json({ error: msg, code });
      return;
    }

    const data = await response.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleanJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let items = [];
    try {
      items = JSON.parse(cleanJson);
    } catch (e) {
      items = [];
    }

    res.status(200).json({ success: true, items });
  } catch (err) {
    console.error('OCR Backend Error:', err);
    res.status(500).json({ error: err.message || 'Ошибка обработки на сервере' });
  }
};
