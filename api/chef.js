// Vercel Serverless Function: AI Chef Recipe & Ingredients Generator
// Generates structured grocery list with quantities and prices in euros via Google Gemini API
// with multi-model fallback cascade

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest'
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
    // Safely parse body if sent as string
    let parsedBody = req.body;
    if (typeof parsedBody === 'string') {
      try { parsedBody = JSON.parse(parsedBody); } catch (e) { parsedBody = {}; }
    }
    parsedBody = parsedBody || {};

    const { dish, servings = 4, mode = 'ingredients', items = [], clientApiKey } = parsedBody;
    const apiKey = (process.env.GEMINI_API_KEY || clientApiKey || '').trim();

    if (!apiKey) {
      res.status(500).json({ error: 'Серверный ключ GEMINI_API_KEY не задан в Environment Variables на Vercel' });
      return;
    }

    let prompt = '';

    if (mode === 'suggest_from_items') {
      prompt = `У пользователя в корзине следующие продукты: ${items.join(', ')}.
Ты — опытный шеф-повар. Предложи 2-3 классных, простых и вкусных домашних блюда из этих продуктов (или докупив 1-2 базовые вещи).
Верни ТОЛЬКО валидный JSON:
{
  "mode": "suggestions",
  "dishes": [
    {
      "title": "Название блюда",
      "description": "Краткое описание (1 предложение)",
      "cookTime": "30 мин",
      "needToBuy": ["Ингредиент 1 (200 г)", "Ингредиент 2 (1 шт)"]
    }
  ]
}`;
    } else {
      if (!dish || !dish.trim()) {
        res.status(400).json({ error: 'Не указано название блюда' });
        return;
      }

      prompt = `Ты — профессиональный шеф-повар. Пользователь готовит: "${dish.trim()}" (на ${servings} персон).
Составь список только необходимых ингредиентов для продуктового магазина в Европе/Эстонии (Selver, Prisma, Rimi, Maxima).
Используй граммовки (например: "500 г", "1 кг", "2 шт", "1 пач.", "200 мл").
Цены укажи в евро (поле price числом, например 1.89, 2.50, 0.90).
Категории (category) строго: dairy, produce, meat, bakery, grocery, drinks, sweets, household, other.

Верни ТОЛЬКО валидный JSON без лишнего текста:
{
  "dishTitle": "${dish.trim()}",
  "servings": ${servings},
  "cookTime": "45 мин",
  "tip": "Короткий полезный совет от шефа (1 предложение)",
  "ingredients": [
    {
      "title": "Сыр Моцарелла",
      "quantity": "250 г",
      "price": 2.20,
      "category": "dairy"
    }
  ]
}`;
    }

    const bodyPayload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json'
      }
    };

    let parsedResult = null;
    let lastError = null;

    // Fallback cascade for models in case of high demand (503/429)
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
          const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) {
            try {
              parsedResult = JSON.parse(candidate);
              break;
            } catch (e) {
              const jsonMatch = candidate.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
              if (jsonMatch) {
                parsedResult = JSON.parse(jsonMatch[0]);
                break;
              }
            }
          }
        } else {
          const errText = await response.text();
          let errJson = {};
          try { errJson = JSON.parse(errText); } catch(e) {}
          const errMsg = errJson?.error?.message || errText;
          const code = errJson?.error?.code || response.status;
          lastError = { status: response.status, message: errMsg, code };

          if (code === 402 || errMsg.includes('credits are depleted')) {
            break;
          }
        }
      } catch (err) {
        lastError = { status: 504, message: err.message };
      }
    }

    if (parsedResult) {
      res.status(200).json({
        success: true,
        data: parsedResult
      });
      return;
    }

    let friendlyMessage = 'Шеф-сервер отвечает дольше обычного. Попробуйте еще раз или выберите одно из популярных блюд!';
    if (lastError?.code === 402 || lastError?.message?.includes('credits are depleted')) {
      friendlyMessage = 'У ключа Google AI исчерпан баланс (ошибка 402). Нужен ключ без биллинга (Google AI Studio).';
    } else if (lastError?.message?.includes('high demand') || lastError?.status === 503) {
      friendlyMessage = 'Сервер Google испытывает пиковую нагрузку. Попробуйте повторить через несколько секунд.';
    }

    res.status(502).json({ error: friendlyMessage, rawError: lastError?.message });

  } catch (err) {
    console.error('Chef error:', err);
    res.status(500).json({ error: err.message || 'Ошибка обработки рецепта' });
  }
};
