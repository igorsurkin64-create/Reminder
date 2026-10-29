// Vercel Serverless Function: AI Chef Recipe & Ingredients Generator
// Generates structured grocery list with quantities and prices in euros via Google Gemini API
// with multi-model fallback cascade

const { handlePreflight, parseBody, resolveApiKey, generateWithFallback, isBillingError } = require('../lib/gemini');

// Ordered by reliability: stable/low-latency models first, newer (often overloaded) ones after
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash'
];

const MAX_DISH_LENGTH = 200;

function buildSuggestPrompt(items) {
  return `У пользователя в корзине следующие продукты: ${items.join(', ')}.
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
}

function buildIngredientsPrompt(dish, servings) {
  // JSON.stringify keeps quotes/newlines in user input from breaking the prompt/JSON template
  const safeDish = JSON.stringify(dish);
  return `Ты — профессиональный шеф-повар. Пользователь готовит: ${safeDish} (на ${servings} персон).
Составь список только необходимых ингредиентов для продуктового магазина в Европе/Эстонии (Selver, Prisma, Rimi, Maxima).
Используй граммовки (например: "500 г", "1 кг", "2 шт", "1 пач.", "200 мл").
Цены укажи в евро (поле price числом, например 1.89, 2.50, 0.90).
Категории (category) строго: dairy, produce, meat, bakery, grocery, drinks, sweets, household, other.

Верни ТОЛЬКО валидный JSON без лишнего текста:
{
  "dishTitle": ${safeDish},
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

function friendlyError(lastError) {
  if (isBillingError(lastError)) {
    return 'У ключа Google AI исчерпан баланс (ошибка 402). Нужен ключ без биллинга (Google AI Studio).';
  }
  if (lastError?.message?.includes('high demand') || lastError?.status === 503) {
    return 'Сервер Google испытывает пиковую нагрузку. Попробуйте повторить через несколько секунд.';
  }
  return 'Шеф-сервер отвечает дольше обычного. Попробуйте еще раз или выберите одно из популярных блюд!';
}

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;

  try {
    const { dish, servings = 4, mode = 'ingredients', items = [] } = parseBody(req);
    const apiKey = resolveApiKey();

    if (!apiKey) {
      res.status(500).json({ error: 'Серверный ключ GEMINI_API_KEY не задан в переменных окружения (.env или Vercel Environment Variables)' });
      return;
    }

    let prompt;
    if (mode === 'suggest_from_items') {
      const safeItems = (Array.isArray(items) ? items : []).map(String).slice(0, 100);
      if (!safeItems.length) {
        res.status(400).json({ error: 'Список продуктов пуст' });
        return;
      }
      prompt = buildSuggestPrompt(safeItems);
    } else {
      const dishName = typeof dish === 'string' ? dish.trim().slice(0, MAX_DISH_LENGTH) : '';
      if (!dishName) {
        res.status(400).json({ error: 'Не указано название блюда' });
        return;
      }
      const safeServings = Math.min(Math.max(parseInt(servings, 10) || 4, 1), 50);
      prompt = buildIngredientsPrompt(dishName, safeServings);
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json'
      }
    };

    const { result, lastError } = await generateWithFallback(CANDIDATE_MODELS, apiKey, payload);

    if (result) {
      res.status(200).json({ success: true, data: result });
      return;
    }

    res.status(502).json({ error: friendlyError(lastError), rawError: lastError?.message });
  } catch (err) {
    console.error('Chef error:', err);
    res.status(500).json({ error: err.message || 'Ошибка обработки рецепта' });
  }
};
