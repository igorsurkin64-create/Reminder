// Russian Natural Language Parser for Voice Grocery Lists

const CATEGORIES = {
  dairy: {
    id: 'dairy',
    name: 'Молочное',
    icon: '🥛',
    color: '#38bdf8',
    keywords: [
      'молок', 'кефир', 'сыр', 'творог', 'масл', 'масло сливочн', 'сметан', 'ряженк', 'сливк', 
      'йогурт', 'сгущенк', 'маскарпоне', 'пармезан', 'моцарелл', 'брынз', 'простокваш', 
      'активиа', 'сырок', 'снежок', 'яйц', 'яиц'
    ]
  },
  produce: {
    id: 'produce',
    name: 'Овощи и фрукты',
    icon: '🍏',
    color: '#4ade80',
    keywords: [
      'яблок', 'банан', 'картоф', 'картошк', 'лук', 'морков', 'помидор', 'томат', 
      'огур', 'чеснок', 'зелен', 'укроп', 'петрушк', 'апельсин', 'лимон', 'капуст', 
      'перец', 'ягод', 'клубник', 'малин', 'черник', 'виноград', 'мандарин', 'груш', 
      'свекл', 'буряк', 'кабачок', 'баклажан', 'авокадо', 'салат', 'шпинат', 'айсберг', 
      'гриб', 'шампиньон', 'редис', 'киви', 'гранат', 'арбуз', 'дын'
    ]
  },
  meat: {
    id: 'meat',
    name: 'Мясо и рыба',
    icon: '🥩',
    color: '#f87171',
    keywords: [
      'мяс', 'куриц', 'кур', 'цыплен', 'говядин', 'свинин', 'фарш', 'сосиск', 'сардельк', 'колбас', 
      'рыб', 'лосос', 'семг', 'форел', 'филе', 'креветк', 'индейк', 'бекон', 'ветчин', 
      'котлет', 'минтай', 'тунец', 'кальмар', 'карбонад', 'окорок', 'шашлык', 'пельмен', 'вареник'
    ]
  },
  bakery: {
    id: 'bakery',
    name: 'Хлеб и выпечка',
    icon: '🥐',
    color: '#fbbf24',
    keywords: [
      'хлеб', 'батон', 'булочк', 'булк', 'лаваш', 'печень', 'круассан', 'торт', 
      'пирог', 'багет', 'пряник', 'сухар', 'бублик', 'пита', 'чиабатт', 'лепешк'
    ]
  },
  grocery: {
    id: 'grocery',
    name: 'Бакалея',
    icon: '🌾',
    color: '#a78bfa',
    keywords: [
      'макарон', 'паст', 'спагетти', 'рис', 'гречк', 'греч', 'мук', 'сахар', 'сол', 
      'масл', 'масло растительн', 'масло подсолнечн', 'масло оливков', 'чай', 'кофе', 'овсянк', 
      'хлопь', 'специ', 'приправ', 'соус', 'кетчуп', 'майонез', 'горчиц', 'уксус', 
      'горох', 'фасол', 'чечевиц', 'консерв', 'тушенк', 'кукуруз', 'бульон', 'круп'
    ]
  },
  drinks: {
    id: 'drinks',
    name: 'Напитки',
    icon: '🧃',
    color: '#2dd4bf',
    keywords: [
      'вод', 'минералк', 'сок', 'газировк', 'кола', 'лимонад', 'квас', 'морс', 
      'компот', 'пиво', 'вино', 'тоник', 'энергетик'
    ]
  },
  sweets: {
    id: 'sweets',
    name: 'Сладости',
    icon: '🍫',
    color: '#f472b6',
    keywords: [
      'шоколад', 'конфет', 'вафл', 'мармелад', 'зефир', 'мед', 'пастил', 'халв', 
      'карамел', 'морожен', 'чупа-чупс', 'нутелл'
    ]
  },
  household: {
    id: 'household',
    name: 'Быт и уход',
    icon: '🧼',
    color: '#818cf8',
    keywords: [
      'мыл', 'шампун', 'порошок', 'средство', 'салфетк', 'туалетн', 'бумаг', 'губк', 
      'зубн', 'паст', 'пакет', 'фольг', 'пергамент', 'освежител', 'гель для душ', 
      'бальзам', 'дезодорант', 'ватн'
    ]
  },
  other: {
    id: 'other',
    name: 'Разное',
    icon: '🛒',
    color: '#94a3b8',
    keywords: []
  }
};

const NUMBER_WORDS = {
  'один': 1, 'одну': 1, 'одна': 1,
  'два': 2, 'две': 2, 'пару': 2,
  'три': 3,
  'четыре': 4,
  'пять': 5,
  'шесть': 6,
  'семь': 7,
  'восемь': 8,
  'девять': 9,
  'десять': 10,
  'десяток': 10,
  'полтора': 1.5,
  'полторы': 1.5,
  'полкило': 0.5,
  'пол': 0.5
};

class GroceryParser {
  // Strip conversational filler like "хочу добавить", "купи пожалуйста", "надо взять", etc.
  cleanInput(text) {
    if (!text) return '';
    let cleaned = text.trim().toLowerCase();

    // Remove speech fillers and introductory intents
    const fillers = [
      /^(?:я\s+)?(?:хочу\s+)?(?:добавить|добавь|добавьте)\s+/i,
      /^(?:я\s+)?(?:хочу\s+)?(?:купить|купи|купите)\s+/i,
      /^(?:мне\s+)?(?:надо|нужно|нужна|нужен|нужны|хочется)(?:\s+(?:купить|взять|добавить))?\s+/i,
      /^(?:надо\s+бы|давай\s+купим|запиши|записать|закинь|внеси)\s+/i,
      /^(?:возьми|взять|возьмите|пожалуйста|еще|и\s+еще|не\s+забудь(?:\s+купить)?)\s+/i
    ];

    let changed = true;
    while (changed) {
      changed = false;
      for (const rx of fillers) {
        if (rx.test(cleaned)) {
          cleaned = cleaned.replace(rx, '').trim();
          changed = true;
        }
      }
    }

    // Clean ending fillers like "... в список", "... в корзину", "... пожалуйста", "... и всё"
    cleaned = cleaned.replace(/\s+(?:в\s+список|в\s+корзину|пожалуйста|купи|и\s+всё|и\s+все|пока\s+всё|пока\s+все)$/i, '').trim();

    return cleaned;
  }

  // Clean conversational tail and leading filler words ("сыр ещё", "хлеб тоже", "так сыр")
  cleanFillers(text) {
    if (!text) return '';
    let t = text.trim();

    // Trailing conversational parasite words
    const trailingRegex = /\s+(?:еще|ещё|тоже|давай|давайте|пожалуйста|и\s+все|и\s+всё|пока\s+все|пока\s+всё|на\s+этом\s+всё|на\s+этом\s+все|всё|все|наверное|пожалуй|что\s+ли|кстати|как-то\s+так|вот)$/i;
    while (trailingRegex.test(t)) {
      t = t.replace(trailingRegex, '').trim();
    }

    // Leading conversational fillers
    const leadingRegex = /^(?:ну|так|значит|слушай|смотри|короче|давай|давайте|еще|ещё|а|и|также)\s+/i;
    while (leadingRegex.test(t)) {
      t = t.replace(leadingRegex, '').trim();
    }

    return t;
  }

  // Convert accusative cases (e.g. "колбасу" -> "Колбаса", "сметану" -> "Сметана")
  normalizeTitle(text) {
    if (!text) return '';
    const words = text.trim().toLowerCase().split(/\s+/);
    const converted = words.map((w) => {
      if (w.endsWith('ую')) {
        return w.slice(0, -2) + 'ая';
      }
      if (w.endsWith('яю')) {
        return w.slice(0, -2) + 'яя';
      }
      if (w.length >= 4 && w.endsWith('у')) {
        return w.slice(0, -1) + 'а';
      }
      if (w.length >= 4 && w.endsWith('ю')) {
        return w.slice(0, -1) + 'я';
      }
      return w;
    }).join(' ');

    return converted.charAt(0).toUpperCase() + converted.slice(1);
  }

  // Check if a word is an adjective
  isAdjective(word) {
    if (!word) return false;
    const w = word.toLowerCase();
    return /(?:ый|ий|ой|ая|яя|ое|ее|ые|ие|ую|юю|ого|его|ому|ему|ым|им|их|ых|ными|скими|ной|ской|ного|ского)$/i.test(w);
  }

  // Check if a word starts with or matches a known product stem (and is not an adjective)
  isProductNoun(word) {
    if (!word || word.length < 3) return false;
    const w = word.toLowerCase();
    if (this.isAdjective(w)) return false;

    // Check against all known categories
    for (const cat of Object.values(CATEGORIES)) {
      if (cat.keywords.some(k => w.startsWith(k) || (k.length >= 4 && w.includes(k)))) {
        return true;
      }
    }
    return false;
  }

  // Smartly split multiple items listed with or without conjunctions ("сосиски курица", "хлеб сыр молоко")
  splitPhraseIntoItems(cleaned) {
    // 1. Replace spoken conjunctions and transition words with commas
    let text = cleaned.replace(/\s+(?:и|а\s+также|да\s+еще|да\s+ещё|да|плюс|потом|также|еще|ещё|затем)\s+/gi, ', ');

    // 2. Initial split by commas/punctuation
    const initialParts = text.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
    const result = [];

    for (const part of initialParts) {
      const words = part.split(/\s+/).filter(Boolean);
      if (words.length <= 1) {
        result.push(part);
        continue;
      }

      let currentWords = [];
      let currentHasNoun = false;

      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const isNoun = this.isProductNoun(w);

        // If we already captured a full product noun, and encounter another independent product noun
        if (currentHasNoun && isNoun) {
          result.push(currentWords.join(' '));
          currentWords = [w];
          currentHasNoun = true;
        } else {
          currentWords.push(w);
          if (isNoun) {
            currentHasNoun = true;
          }
        }
      }

      if (currentWords.length > 0) {
        result.push(currentWords.join(' '));
      }
    }

    return result;
  }

  // Parse speech or typed text into a list of items
  parse(rawText) {
    const cleaned = this.cleanInput(rawText);
    if (!cleaned) return [];

    // Split text into candidate phrases (handles commas, conjunctions, and sequential food words without commas)
    const tokens = this.splitPhraseIntoItems(cleaned);

    const items = [];

    for (const token of tokens) {
      const parsedItem = this.parseSingleItem(token);
      if (parsedItem && parsedItem.title) {
        items.push(parsedItem);
      }
    }

    return items;
  }

  // Extract prices in Euro and Cents, or other currencies:
  // "1 евро 50 центов", "99 центов", "2.50 евро", "за 1.49", "по 2.50 €"
  extractPrice(rawText) {
    let text = rawText;
    let price = null;

    // 1. Euro + Cents: "1 евро 50 центов", "2 евро 80", "1 евро 5 ц"
    const euroCentRegex = /(?:(?:по|за|цена|стоимость)\s*)?(\d+)\s*(?:евро|эвро|€|eur)\s*(?:и\s*)?(\d{1,2})\s*(?:цент(?:ов|а)?|ц)?(?:\s+|$)/i;
    const matchEuroCent = text.match(euroCentRegex);
    if (matchEuroCent) {
      const e = parseInt(matchEuroCent[1], 10);
      const c = parseInt(matchEuroCent[2], 10);
      price = parseFloat((e + c / 100).toFixed(2));
      text = text.replace(matchEuroCent[0], ' ').trim();
      return { price, text };
    }

    // 2. Cents only: "80 центов", "за 99 центов", "50 ц"
    const centsOnlyRegex = /(?:(?:по|за|цена|стоимость)\s*)?(\d{1,2})\s*(?:цент(?:ов|а)?|ц)(?:\s+|$)/i;
    const matchCents = text.match(centsOnlyRegex);
    if (matchCents) {
      const c = parseInt(matchCents[1], 10);
      price = parseFloat((c / 100).toFixed(2));
      text = text.replace(matchCents[0], ' ').trim();
      return { price, text };
    }

    // 3. Euro explicit: "2.50 евро", "за 1,89 €", "по 3 eur"
    const euroExplicitRegex = /(?:(?:по|за|цена|стоимость)\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:евро|эвро|€|eur)(?:\s+|$)/i;
    const matchEuro = text.match(euroExplicitRegex);
    if (matchEuro) {
      const val = parseFloat(matchEuro[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        price = parseFloat(val.toFixed(2));
        text = text.replace(matchEuro[0], ' ').trim();
        return { price, text };
      }
    }

    // 4. "за 1.89", "по 2.50", "за 120"
    const prepPriceRegex = /(?:по|за|цена|стоимость)\s*(\d+(?:[.,]\d{1,2})?)\s*(?:руб(?:лей|ля)?|р|₽)?(?:\s+|$)/i;
    const matchPrep = text.match(prepPriceRegex);
    if (matchPrep) {
      const val = parseFloat(matchPrep[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        price = val % 1 === 0 ? Math.round(val) : parseFloat(val.toFixed(2));
        text = text.replace(matchPrep[0], ' ').trim();
        return { price, text };
      }
    }

    // 5. Rubles/Dollars explicit: "250 рублей", "$5"
    const rubleRegex = /(\d+(?:[.,]\d{1,2})?)\s*(?:руб(?:лей|ля)?|р|₽)(?:\s+|$)/i;
    const matchRub = text.match(rubleRegex);
    if (matchRub) {
      const val = parseFloat(matchRub[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        price = val % 1 === 0 ? Math.round(val) : parseFloat(val.toFixed(2));
        text = text.replace(matchRub[0], ' ').trim();
        return { price, text };
      }
    }

    return { price: null, text };
  }

  // Parse an individual item phrase (e.g., "два пакета молока", "полкило сыра", "хлеб 1 шт")
  parseSingleItem(phrase) {
    let text = phrase.trim();
    if (!text) return null;

    let quantity = '';
    let unit = '';

    // Extract price (e.g. "1 евро 50 центов", "99 центов", "за 1.49", "по 2.50 €")
    const extracted = this.extractPrice(text);
    const price = extracted.price;
    text = extracted.text;

    // Check for "полкило"
    if (/полкило\s*/i.test(text)) {
      quantity = '0.5';
      unit = 'кг';
      text = text.replace(/полкило\s*/i, '').trim();
    }

    // Check for "десяток"
    if (/десяток\s*/i.test(text)) {
      quantity = '10';
      unit = 'шт';
      text = text.replace(/десяток\s*/i, '').trim();
    }

    // Check for digit + unit: "2 кг", "1.5 л", "5 шт", "300 г"
    const digitUnitRegex = /(\d+(?:[.,]\d+)?)\s*(кг|килограмм(?:а|ов)?|г|гр|грамм(?:а|ов)?|л|литр(?:а|ов)?|мл|шт|штук(?:и|а)?|пак(?:ета?|етов)?|пач(?:ки|ка|ек)|бут(?:ылки?|ылок)?|бухан(?:ки|ка|ок)?|бан(?:ки|ка|ок)?)(?:\s+|$)/i;
    const matchDigit = text.match(digitUnitRegex);

    if (matchDigit) {
      quantity = matchDigit[1].replace(',', '.');
      if (matchDigit[2]) {
        unit = this.normalizeUnit(matchDigit[2]);
      }
      text = text.replace(matchDigit[0], ' ').trim();
    } else {
      // Check for standalone numbers
      const digitOnlyRegex = /(\d+(?:[.,]\d+)?)(?:\s+|$)/;
      const matchOnlyDigit = text.match(digitOnlyRegex);
      if (matchOnlyDigit) {
        quantity = matchOnlyDigit[1].replace(',', '.');
        text = text.replace(matchOnlyDigit[0], ' ').trim();
      }

      // Check for word numbers: "два пакета", "три штуки", "одна буханка"
      for (const [word, val] of Object.entries(NUMBER_WORDS)) {
        const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
        if (wordRegex.test(text)) {
          quantity = String(val);
          text = text.replace(wordRegex, '').trim();

          // Check if followed by unit
          const unitRegex = /^(кг|килограмм(?:а|ов)?|г|гр|грамм(?:а|ов)?|л|литр(?:а|ов)?|мл|шт|штук(?:и|а)?|пакетов|пакет|пакета|пачки|пачка|бутылок|бутылка|бутылки|буханка|буханки|банка|банки)(?:\s+|$)/i;
          const matchWordUnit = text.match(unitRegex);
          if (matchWordUnit) {
            unit = this.normalizeUnit(matchWordUnit[1]);
            text = text.replace(matchWordUnit[0], ' ').trim();
          }
          break;
        }
      }
    }

    // Clean up residual words like "штук", "упаковку" etc.
    text = text.replace(/^(штук|штуки|пакет|бутылку|упаковку)\s+/i, '').trim();

    // Strip trailing and leading conversational fillers (e.g. "сыр ещё", "хлеб тоже")
    text = this.cleanFillers(text);

    // Normalize grammar & Capitalize first letter
    if (!text) return null;
    const title = this.normalizeTitle(text);

    // Detect category
    const category = this.detectCategory(text);

    return {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: title,
      quantity: quantity ? `${quantity} ${unit}`.trim() : (unit ? `1 ${unit}` : ''),
      price: price,
      category: category.id,
      completed: false,
      createdAt: Date.now()
    };
  }

  normalizeUnit(raw) {
    const r = raw.toLowerCase();
    if (r.startsWith('кг') || r.startsWith('кило')) return 'кг';
    if (r.startsWith('г') || r.startsWith('гр')) return 'г';
    if (r.startsWith('л') || r.startsWith('лит')) return 'л';
    if (r.startsWith('мл')) return 'мл';
    if (r.startsWith('пак')) return 'пак.';
    if (r.startsWith('пач')) return 'пач.';
    if (r.startsWith('бут')) return 'бут.';
    if (r.startsWith('бух')) return 'бух.';
    if (r.startsWith('бан')) return 'бан.';
    if (r.startsWith('шт')) return 'шт.';
    return raw;
  }

  detectCategory(text) {
    const lower = text.toLowerCase();
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      if (key === 'other') continue;
      for (const kw of cat.keywords) {
        if (lower.includes(kw)) {
          return cat;
        }
      }
    }
    return CATEGORIES.other;
  }

  // Russian morphological stemmer for grocery items
  getStem(word) {
    if (!word || word.length < 3) return word.toLowerCase();
    return word.toLowerCase()
      .replace(/(ого|его|ому|ему|ыми|ими|ами|ями|ов|ев|ей|ий|ый|ой|ая|яя|ое|ее|ые|ие|ую|юю|ам|ям|ах|ях|ом|ем|а|я|о|е|ы|и|у|ю)$/i, '');
  }

  // Check if search phrase or word matches an item in the list
  matchesItem(targetPhrase, item) {
    const p = targetPhrase.toLowerCase().trim();
    const title = item.title.toLowerCase();

    // Direct substring match
    if (title.includes(p) || p.includes(title)) {
      return true;
    }

    // Stem matching
    const pWords = p.split(/\s+/).filter(w => w.length >= 3);
    const itemWords = title.split(/\s+/).filter(w => w.length >= 3);

    for (const pw of pWords) {
      const pStem = this.getStem(pw);
      for (const iw of itemWords) {
        const iStem = this.getStem(iw);
        if (pStem.length >= 3 && iStem.length >= 3) {
          if (iStem.startsWith(pStem) || pStem.startsWith(iStem) || iw.includes(pStem) || pw.includes(iStem)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Detect whether spoken input is a command to cross out (complete), restore, or add
  detectVoiceIntent(rawText, existingItems = []) {
    if (!rawText) return { type: 'unknown' };

    const cleaned = rawText.trim().toLowerCase();
    const uncompletedItems = existingItems.filter(i => !i.completed);

    // 0. Check for Status / "Did I buy everything?" / "What did I forget?" / "What is left?"
    const checkStatusRegex = /(что\s+(?:я\s+)?забыл|я\s+что[- ]то\s+забыл|что\s+(?:еще\s+|ещё\s+)?осталось|всё\s+ли\s+купил|все\s+ли\s+купил|всё\s+ли\s+я\s+купил|все\s+ли\s+я\s+купил|всё\s+купил|все\s+купил|всё\s+куплено|все\s+куплено|что\s+надо\s+купить|что\s+нужно\s+купить|проверь(?:\s+список|\s+корзину|\s+покупки)?|сколько\s+осталось)/i;
    if (checkStatusRegex.test(cleaned)) {
      return {
        type: 'check_status'
      };
    }

    // Check if a price was mentioned (e.g. "купил молоко за 1.49", "сыр 2 евро", "хлеб 99 центов", "за 85")
    const priceExtracted = this.extractPrice(cleaned);
    const completionPrice = priceExtracted.price;
    const cleanedForMatching = priceExtracted.text;

    // 1. Check for Complete / Cross-out commands:
    // "я это купил", "это я купил", "купил", "взял", "готово", "есть"
    const genericCompleteRegex = /^(?:я\s+)?(?:это\s+)?(?:купил[аи]?|взял[аи]?|положил[аи]?|готово|есть)$/i;
    if (genericCompleteRegex.test(cleanedForMatching) || cleanedForMatching === 'это я купил') {
      if (uncompletedItems.length > 0) {
        // Complete the first uncompleted item in the active list
        return {
          type: 'complete',
          items: [uncompletedItems[0]],
          price: completionPrice,
          isGeneric: true
        };
      }
      return { type: 'complete', items: [], price: completionPrice, isGeneric: true };
    }

    // Prefix completion: "купил молоко", "я купил сыр", "взял 2 кг яблок", "вычеркни хлеб"
    const prefixCompleteRegex = /^(?:я\s+)?(?:купил[аи]?|взял[аи]?|положил[аи]?(?:\s+в\s+корзину)?|вычеркни(?:те)?|зачеркни(?:те)?|отметь(?:те)?|списал|списать)\s+(.+)$/i;
    const matchPrefix = cleanedForMatching.match(prefixCompleteRegex);

    // Suffix completion: "молоко купил", "сыр взял", "хлеб готово"
    const suffixCompleteRegex = /^(.+?)\s+(?:я\s+)?(?:купил[аи]?|взял[аи]?|готово|есть)$/i;
    const matchSuffix = cleanedForMatching.match(suffixCompleteRegex);

    const targetPhrase = matchPrefix ? matchPrefix[1] : (matchSuffix ? matchSuffix[1] : null);

    if (targetPhrase) {
      // User named a product or several products: e.g. "молоко и сыр"
      const subPhrases = targetPhrase
        .replace(/\s+(и|а также|да еще)\s+/gi, ', ')
        .split(/[,;]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const matchedItems = [];
      for (const phrase of subPhrases) {
        const found = uncompletedItems.find(item => 
          !matchedItems.includes(item) && this.matchesItem(phrase, item)
        );
        if (found) {
          matchedItems.push(found);
        } else {
          // Check completed items as fallback
          const foundCompleted = existingItems.find(item => 
            item.completed && !matchedItems.includes(item) && this.matchesItem(phrase, item)
          );
          if (foundCompleted) {
            matchedItems.push(foundCompleted);
          }
        }
      }

      return {
        type: 'complete',
        items: matchedItems,
        price: completionPrice,
        targetPhrase: targetPhrase
      };
    }

    // 2. Check for Uncomplete / Restore commands:
    // "не купил молоко", "верни хлеб", "отмени сыр"
    const uncompleteRegex = /^(?:не\s+(?:купил[аи]?|взял[аи]?)|верни(?:те)?|сними\s+отметку\s+с?|отмени(?:те)?)\s+(.+)$/i;
    const matchUncomplete = cleaned.match(uncompleteRegex);

    if (matchUncomplete) {
      const phrase = matchUncomplete[1].trim();
      const completedItems = existingItems.filter(i => i.completed);
      const found = completedItems.find(item => this.matchesItem(phrase, item)) ||
                    existingItems.find(item => this.matchesItem(phrase, item));

      return {
        type: 'uncomplete',
        items: found ? [found] : [],
        targetPhrase: phrase
      };
    }

    // 3. Otherwise, it is an Add command!
    const newItems = this.parse(rawText);
    return {
      type: 'add',
      items: newItems,
      rawText: rawText
    };
  }
}

window.GroceryParser = new GroceryParser();
window.CATEGORIES = CATEGORIES;
