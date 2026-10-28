// Vercel Serverless Function: AI Chef (Recipe Ingredients & Meal Planner)
// Generates structured grocery list with quantities and prices in EUR via Google Gemini

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
    const { dish, servings = 4, mode = 'ingredients', items = [], clientApiKey } = req.body || {};
    const apiKey = (process.env.GEMINI_API_KEY || clientApiKey || '').trim();

    if (!apiKey) {
      res.status(500).json({ error: 'Серверный ключ GEMINI_API_KEY не задан в Environment Variables на Vercel' });
      return;
    }

    let prompt = '';

    if (mode === 'suggest_from_items') {
      prompt = `У пользователя в списке покупок/корзине следующие продукты: ${items.join(', ')}.
Ты — опытный шеф-повар. Предложи 2-3 классных, простых и вкусных домашних блюда, которые можно приготовить из этих продуктов (или докупив всего 1-2 базовые вещи).
Для каждого блюда напиши название, примерное время приготовления, краткое описание (1-2 предложения) и список того, что нужно докупить.

Верни ТОЛЬКО валидный JSON:
{
  "mode": "suggestions",
  "suggestions": [
    {
      "dishTitle": "Куриное филе в сливочно-чесночном соусе",
      "cookTime": "30 мин",
      "description": "Нежное филе с золотистой корочкой в ароматном соусе.",
      "missingIngredients": [
        { "title": "Чеснок", "quantity": "3 зубч.", "price": 0.40, "category": "produce" }
      ]
    }
  ]
}`;
    } else {
      if (!dish || !dish.trim()) {
        res.status(400).json({ error: 'Укажите название блюда' });
        return;
      }

      prompt = `Ты — профессиональный шеф-повар и эксперт по продуктовым супермаркетам.
Пользователь хочет приготовить блюдо: "${dish.trim()}" (на ${servings} персон).
Составь список только необходимых ингредиентов, понятных и удобных для покупки в супермаркете (например в Эстонии: Selver, Prisma, Rimi, Maxima).
Используй реальные магазинные фасовки и граммовки (например: "500 г", "1 кг", "2 шт", "1 пач.", "200 мл").
Цены укажи в евро (поле price числом, например 1.89, 2.50, 0.90, ориентируясь на средние европейские цены).
Категории (category) строго одни из: dairy, produce, meat, bakery, grocery, drinks, sweets, household, other.

Верни ТОЛЬКО валидный JSON следующей структуры:
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        response_mime_type: 'application/json'
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      let errJson = {};
      try { errJson = JSON.parse(errText); } catch(e) {}
      const errMsg = errJson?.error?.message || errText;
      res.status(response.status).json({ error: errMsg || `Gemini API error (${response.status})` });
      return;
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidate) {
      res.status(500).json({ error: 'ИИ не вернул ответ, попробуйте еще раз' });
      return;
    }

    let parsedResult = null;
    try {
      parsedResult = JSON.parse(candidate);
    } catch (e) {
      // Try extracting json substring if wrapped in markdown
      const jsonMatch = candidate.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Не удалось распарсить ответ ИИ-шефа');
      }
    }

    res.status(200).json({
      success: true,
      data: parsedResult
    });

  } catch (error) {
    console.error('Chef API Error:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера при обращении к ИИ-шефу' });
  }
};
