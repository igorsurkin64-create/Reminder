// Vercel Serverless Function: AI Vision Handwriting & Printed List Scanner
// Reads photos with any handwriting via Google Gemini Vision with automatic model fallback & retry

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite'
];

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
    let parsedBody = req.body;
    if (typeof parsedBody === 'string') {
      try { parsedBody = JSON.parse(parsedBody); } catch (e) { parsedBody = {}; }
    }
    parsedBody = parsedBody || {};

    const { imageBase64, mimeType = 'image/jpeg', clientApiKey } = parsedBody;
    if (!imageBase64) {
      res.status(400).json({ error: 'Изображение не получено' });
      return;
    }

    const apiKey = (process.env.GEMINI_API_KEY || clientApiKey || '').trim();
    if (!apiKey) {
      res.status(500).json({ error: 'Серверный ключ GEMINI_API_KEY не задан в Environment Variables на Vercel' });
      return;
    }

    const prompt = `Внимательно прочитай эту рукописную или напечатанную записку списка покупок или чек.
Почерк может быть сложным, неразборчивым или беглым — используй контекст продуктового супермаркета, чтобы распознать слова (например: "томат паста" -> "Томатная паста", "губки." -> "Губки для посуды", "крупа собакам" -> "Крупа для собак").
ВАЖНО: Если пункт зачёркнут ручкой или линией — ОБЯЗАТЕЛЬНО пропусти его (он уже куплен или вычеркнут).
Нормализуй падеж слов в именительный (например: "сметаны" -> "Сметана", "творог" -> "Творог").
Отдели количество (например: "1 кг", "300 г", "2 шт", "1 пач."), если указано.
Если рядом с товаром указана цена (например: "1.89 €", "2.50", "99 центов", "0.99"), запиши её числом в евро в поле "price" (например 1.89), иначе null.

Верни ТОЛЬКО валидный JSON массив объектов:
[
  {
    "title": "Томатная паста",
    "quantity": "1 бан.",
    "price": null,
    "category": "grocery"
  }
]
Категории (category) строго одни из: dairy, produce, meat, bakery, grocery, drinks, sweets, household, other.`;

    const bodyPayload = {
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

    let lastError = null;
    let items = null;
    let successfulModel = null;

    // Fallback cascade across available models in case of high demand / rate limits (503/429)
    for (const model of CANDIDATE_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7500);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
          const cleanJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          try {
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed)) {
              items = parsed;
              successfulModel = model;
              break; // Success! Exit model loop
            }
          } catch (jsonErr) {
            console.warn(`JSON parse error from ${model}:`, jsonErr.message);
          }
        } else {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${response.status}`;
          const errStatus = errJson.error?.status;
          const code = errJson.error?.code;

          lastError = { status: response.status, message: errMsg, code, errStatus };
          console.warn(`Model ${model} returned ${response.status}: ${errMsg}. Trying fallback model...`);

          // If billing is depleted (402), switching models on the same key won't help
          if (code === 402 || errStatus === 'RESOURCE_EXHAUSTED' || errMsg.includes('credits are depleted')) {
            break;
          }
        }
      } catch (fetchErr) {
        lastError = { status: 504, message: fetchErr.message };
        console.warn(`Fetch error for model ${model}: ${fetchErr.message}. Trying fallback model...`);
      }
    }

    if (Array.isArray(items)) {
      res.status(200).json({ success: true, items, model: successfulModel });
      return;
    }

    // Friendly humanized Russian error
    let friendlyMessage = 'Серверы распознавания временно перегружены. Пожалуйста, нажмите «Повторить попытку» через несколько секунд.';
    if (lastError) {
      if (lastError.code === 402 || lastError.message?.includes('credits are depleted')) {
        friendlyMessage = 'У ключа Google AI исчерпан баланс (ошибка 402). Нужен ключ без биллинга (Google AI Studio -> Create API key).';
      } else if (lastError.message?.includes('API_KEY_INVALID') || lastError.code === 400) {
        friendlyMessage = 'Неверный ключ Google Gemini API. Проверьте настройки API ключа.';
      } else if (lastError.message?.includes('high demand') || lastError.status === 503) {
        friendlyMessage = 'Серверы Google сейчас испытывают пиковую нагрузку. Нажмите «Повторить попытку» через 5-10 секунд.';
      }
    }

    res.status(502).json({
      error: friendlyMessage,
      rawError: lastError?.message,
      code: lastError?.code
    });

  } catch (err) {
    console.error('OCR Backend Error:', err);
    res.status(500).json({ error: err.message || 'Ошибка обработки на сервере' });
  }
};
