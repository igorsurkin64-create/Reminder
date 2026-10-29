// Vercel Serverless Function: AI Vision Handwriting & Printed List Scanner
// Reads photos with any handwriting via Google Gemini Vision with automatic model fallback

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

const PROMPT = `Внимательно прочитай эту рукописную или напечатанную записку списка покупок или чек.
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

function friendlyError(lastError) {
  if (isBillingError(lastError)) {
    return 'У ключа Google AI исчерпан баланс (ошибка 402). Нужен ключ без биллинга (Google AI Studio -> Create API key).';
  }
  if (lastError?.message?.includes('API_KEY_INVALID') || lastError?.code === 400) {
    return 'Неверный ключ Google Gemini API. Проверьте настройки API ключа.';
  }
  if (lastError?.message?.includes('high demand') || lastError?.status === 503) {
    return 'Серверы Google сейчас испытывают пиковую нагрузку. Нажмите «Повторить попытку» через 5-10 секунд.';
  }
  return 'Серверы распознавания временно перегружены. Пожалуйста, нажмите «Повторить попытку» через несколько секунд.';
}

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = parseBody(req);
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      res.status(400).json({ error: 'Изображение не получено' });
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
      res.status(400).json({ error: 'Неподдерживаемый формат изображения' });
      return;
    }

    const apiKey = resolveApiKey();
    if (!apiKey) {
      res.status(500).json({ error: 'Серверный ключ GEMINI_API_KEY не задан в переменных окружения (.env или Vercel Environment Variables)' });
      return;
    }

    const payload = {
      contents: [{
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json'
      }
    };

    const { result, model, lastError } = await generateWithFallback(
      CANDIDATE_MODELS, apiKey, payload, Array.isArray
    );

    if (Array.isArray(result)) {
      res.status(200).json({ success: true, items: result, model });
      return;
    }

    res.status(502).json({
      error: friendlyError(lastError),
      rawError: lastError?.message,
      code: lastError?.code
    });
  } catch (err) {
    console.error('OCR Backend Error:', err);
    res.status(500).json({ error: err.message || 'Ошибка обработки на сервере' });
  }
};
