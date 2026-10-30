// Vercel Serverless Function: AI Vision Handwriting & Printed List Scanner
// Reads photos with any handwriting via Google Gemini Vision with automatic model fallback

const { handlePreflight, parseBody, resolveApiKey, generateWithFallback, formatFriendlyGeminiError } = require('../lib/gemini');

// Ordered by reliability: stable/low-latency models first, independent lite pools, newer ones after
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash'
];

const PROMPT = `Внимательно прочитай эту фотографию. Это может быть:
— рукописная записка списка покупок (на русском),
— напечатанный кассовый чек из эстонского супермаркета (Selver, Rimi, Prisma, Maxima, Coop — текст на эстонском),
— или смешанный список на любом языке.

Правила:
1. ЯЗЫК ВЫВОДА — ВСЕГДА РУССКИЙ. Переведи все названия товаров на русский язык, даже если на фото они на эстонском или английском.
   Примеры перевода с эстонского: "Piim 2.5%" -> "Молоко 2,5%", "Sai" -> "Хлеб", "Munad 10tk" -> "Яйца 10 шт", "Kodujuust" -> "Творог", "Kana filee" -> "Куриное филе", "Hapukoor" -> "Сметана", "Võileivavõi" -> "Сливочное масло", "Šokolaad" -> "Шоколад", "Kartul" -> "Картофель", "Õlu" -> "Пиво", "Mahl" -> "Сок".
2. Если пункт зачёркнут ручкой или линией — ПРОПУСТИ его.
3. Почерк может быть неразборчивым — используй контекст супермаркета, чтобы угадать слова (например: "томат паста" -> "Томатная паста", "губки." -> "Губки для посуды").
4. Нормализуй падеж в именительный (например: "сметаны" -> "Сметана").
5. Отдели количество (например: "1 кг", "300 г", "2 шт", "1 пач.", "10 tk" -> "10 шт"), если указано.
6. Если рядом с товаром указана цена (например: "1.89 €", "2.50", "0.99"), запиши её числом в евро в поле "price" (например 1.89), иначе null.
7. В кассовых чеках строки со словами "KOKKU", "SULARAHA", "TAGASI", "MAKSUSTAMATA", "KÄIBEMAKS", "KAART", "EAN", а также итоговые суммы, номера карт и даты — ПРОПУСТИ, это не товары.

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
      error: formatFriendlyGeminiError(lastError),
      rawError: lastError?.message,
      code: lastError?.code
    });
  } catch (err) {
    console.error('OCR Backend Error:', err);
    res.status(500).json({ error: err.message || 'Ошибка обработки на сервере' });
  }
};
