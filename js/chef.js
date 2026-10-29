// AI Chef Manager: Generates grocery recipe ingredients and suggests meals from cart items

const PRELOADED_RECIPES = {
  'борщ': {
    dishTitle: 'Борщ классический',
    servings: 4,
    cookTime: '1 час 15 мин',
    tip: 'Свеклу лучше тушить с каплей лимона или уксуса для яркого рубинового цвета.',
    ingredients: [
      { title: 'Говядина на кости', quantity: '500 г', price: 4.50, category: 'meat' },
      { title: 'Свёкла', quantity: '2 шт.', price: 0.80, category: 'produce' },
      { title: 'Капуста белокочанная', quantity: '400 г', price: 0.60, category: 'produce' },
      { title: 'Картофель', quantity: '4 шт.', price: 0.70, category: 'produce' },
      { title: 'Морковь', quantity: '1 шт.', price: 0.30, category: 'produce' },
      { title: 'Лук репчатый', quantity: '1 шт.', price: 0.25, category: 'produce' },
      { title: 'Томатная паста', quantity: '1 бан.', price: 1.10, category: 'grocery' },
      { title: 'Чеснок', quantity: '3 зубч.', price: 0.35, category: 'produce' },
      { title: 'Сметана 20%', quantity: '1 пач.', price: 1.29, category: 'dairy' },
      { title: 'Зелень свежая', quantity: '1 пуч.', price: 0.89, category: 'produce' }
    ]
  },
  'сырник': {
    dishTitle: 'Сырники творожные',
    servings: 4,
    cookTime: '25 мин',
    tip: 'Творог лучше брать сухой, 5% или 9%, чтобы сырники держали форму.',
    ingredients: [
      { title: 'Творог 9%', quantity: '400 г', price: 2.20, category: 'dairy' },
      { title: 'Яйца куриные', quantity: '1 шт.', price: 0.30, category: 'dairy' },
      { title: 'Мука пшеничная', quantity: '3 ст. л.', price: 0.40, category: 'grocery' },
      { title: 'Сахар', quantity: '2 ст. л.', price: 0.20, category: 'grocery' },
      { title: 'Ванильный сахар', quantity: '1 пач.', price: 0.35, category: 'grocery' },
      { title: 'Масло растительное', quantity: '50 мл', price: 0.30, category: 'grocery' },
      { title: 'Сметана для подачи', quantity: '1 пач.', price: 1.29, category: 'dairy' }
    ]
  },
  'карбонар': {
    dishTitle: 'Паста Карбонара',
    servings: 4,
    cookTime: '20 мин',
    tip: 'Соус готовят на желтках и сыре без добавления сливок!',
    ingredients: [
      { title: 'Спагетти', quantity: '400 г', price: 1.20, category: 'grocery' },
      { title: 'Бекон или панчетта', quantity: '150 г', price: 2.30, category: 'meat' },
      { title: 'Яйца (желтки)', quantity: '4 шт.', price: 0.90, category: 'dairy' },
      { title: 'Сыр Пармезан', quantity: '100 г', price: 2.50, category: 'dairy' },
      { title: 'Чеснок', quantity: '1 зубч.', price: 0.20, category: 'produce' },
      { title: 'Чёрный перец молотый', quantity: '1 пач.', price: 0.60, category: 'grocery' }
    ]
  },
  'пицц': {
    dishTitle: 'Пицца домашняя',
    servings: 4,
    cookTime: '35 мин',
    tip: 'Выпекайте на максимальной температуре духовки 220-250°C.',
    ingredients: [
      { title: 'Мука для пиццы', quantity: '350 г', price: 0.70, category: 'grocery' },
      { title: 'Дрожжи сухие', quantity: '1 пач.', price: 0.45, category: 'grocery' },
      { title: 'Сыр Моцарелла', quantity: '200 г', price: 1.89, category: 'dairy' },
      { title: 'Томатный соус / пассата', quantity: '150 г', price: 1.10, category: 'grocery' },
      { title: 'Колбаски салями / пепперони', quantity: '120 г', price: 1.95, category: 'meat' },
      { title: 'Орегано или базилик', quantity: '1 пач.', price: 0.65, category: 'grocery' }
    ]
  },
  'плов': {
    dishTitle: 'Плов с мясом',
    servings: 4,
    cookTime: '1 час 10 мин',
    tip: 'Морковь лучше резать длинной соломкой, а не тереть на тёрке.',
    ingredients: [
      { title: 'Мясо (говядина/свинина)', quantity: '500 г', price: 4.80, category: 'meat' },
      { title: 'Рис длиннозёрный', quantity: '400 г', price: 1.15, category: 'grocery' },
      { title: 'Морковь', quantity: '400 г', price: 0.45, category: 'produce' },
      { title: 'Лук репчатый', quantity: '2 шт.', price: 0.40, category: 'produce' },
      { title: 'Чеснок', quantity: '1 головка', price: 0.50, category: 'produce' },
      { title: 'Зира (кумин)', quantity: '1 пач.', price: 0.75, category: 'grocery' },
      { title: 'Масло растительное', quantity: '100 мл', price: 0.40, category: 'grocery' }
    ]
  },
  'шарлотк': {
    dishTitle: 'Шарлотка с яблоками',
    servings: 4,
    cookTime: '40 мин',
    tip: 'Взбейте яйца с сахаром до пышной белой пены, чтобы пирог был воздушным.',
    ingredients: [
      { title: 'Яблоки кисло-сладкие', quantity: '4 шт.', price: 1.10, category: 'produce' },
      { title: 'Яйца куриные', quantity: '4 шт.', price: 0.95, category: 'dairy' },
      { title: 'Сахар', quantity: '1 стакан', price: 0.35, category: 'grocery' },
      { title: 'Мука пшеничная', quantity: '1 стакан', price: 0.30, category: 'grocery' },
      { title: 'Корица молотая', quantity: '1 пач.', price: 0.55, category: 'grocery' },
      { title: 'Сливочное масло', quantity: '20 г', price: 0.30, category: 'dairy' }
    ]
  },
  'оливье': {
    dishTitle: 'Салат Оливье',
    servings: 4,
    cookTime: '35 мин',
    tip: 'Овощи варите в кожуре и охладите перед нарезкой, чтобы кубики не слипались.',
    ingredients: [
      { title: 'Колбаса докторская', quantity: '300 г', price: 2.10, category: 'meat' },
      { title: 'Картофель', quantity: '3 шт.', price: 0.50, category: 'produce' },
      { title: 'Морковь', quantity: '2 шт.', price: 0.40, category: 'produce' },
      { title: 'Яйца куриные', quantity: '4 шт.', price: 0.95, category: 'dairy' },
      { title: 'Огурцы соленые / маринованные', quantity: '1 бан.', price: 1.45, category: 'grocery' },
      { title: 'Горошек консервированный', quantity: '1 бан.', price: 0.99, category: 'grocery' },
      { title: 'Майонез', quantity: '1 пач.', price: 1.25, category: 'grocery' }
    ]
  },
  'шашлык': {
    dishTitle: 'Шашлык из свинины',
    servings: 4,
    cookTime: '45 мин',
    tip: 'Репчатый лук помните руками с солью, чтобы он дал сок для маринада.',
    ingredients: [
      { title: 'Свиная шейка', quantity: '1.5 кг', price: 9.80, category: 'meat' },
      { title: 'Лук репчатый', quantity: '5 шт.', price: 0.90, category: 'produce' },
      { title: 'Специи для шашлыка', quantity: '1 пач.', price: 0.85, category: 'grocery' },
      { title: 'Минеральная газированная вода', quantity: '1 бут.', price: 0.70, category: 'drinks' },
      { title: 'Соус томатный / шашлычный', quantity: '1 бут.', price: 1.40, category: 'grocery' }
    ]
  }
};

class ChefManager {
  constructor(app) {
    this.app = app;
    this.extractedIngredients = [];
    this.currentDishData = null;
    this.abortController = null;

    this.initElements();
    this.initEventListeners();
  }

  initElements() {
    this.chefModal = document.getElementById('chefModal');
    this.closeChefBtn = document.getElementById('closeChefBtn');
    this.dockChefBtn = document.getElementById('dockChefBtn');
    this.chefDishInput = document.getElementById('chefDishInput');
    this.chefSubmitBtn = document.getElementById('chefSubmitBtn');
    this.chefSuggestFromCartBtn = document.getElementById('chefSuggestFromCartBtn');

    // States
    this.chefInputSection = document.getElementById('chefInputSection');
    this.chefLoadingState = document.getElementById('chefLoadingState');
    this.chefLoadingText = document.getElementById('chefLoadingText');
    this.chefCancelLoadingBtn = document.getElementById('chefCancelLoadingBtn');
    this.chefResultsState = document.getElementById('chefResultsState');
    this.chefSuggestionsState = document.getElementById('chefSuggestionsState');

    // Results elements
    this.chefDishTitle = document.getElementById('chefDishTitle');
    this.chefCookTime = document.getElementById('chefCookTime');
    this.chefTipText = document.getElementById('chefTipText');
    this.chefIngCountText = document.getElementById('chefIngCountText');
    this.chefSelectAllBtn = document.getElementById('chefSelectAllBtn');
    this.chefIngredientsList = document.getElementById('chefIngredientsList');
    this.chefBackBtn = document.getElementById('chefBackBtn');
    this.chefAddSelectedBtn = document.getElementById('chefAddSelectedBtn');

    // Suggestions elements
    this.chefSuggestionsList = document.getElementById('chefSuggestionsList');
    this.chefSuggestionsBackBtn = document.getElementById('chefSuggestionsBackBtn');
  }

  initEventListeners() {
    if (this.dockChefBtn) {
      this.dockChefBtn.addEventListener('click', () => {
        this.open();
      });
    }

    if (this.closeChefBtn) {
      this.closeChefBtn.addEventListener('click', () => {
        this.close();
      });
    }

    if (this.chefCancelLoadingBtn) {
      this.chefCancelLoadingBtn.addEventListener('click', () => {
        if (this.abortController) {
          this.abortController.abort();
        }
        this.showInputState();
      });
    }

    if (this.chefModal) {
      this.chefModal.addEventListener('click', (e) => {
        if (e.target === this.chefModal) {
          this.close();
        }
      });
    }

    // Submit dish input
    if (this.chefSubmitBtn && this.chefDishInput) {
      const submitHandler = () => {
        const dish = this.chefDishInput.value.trim();
        if (dish) {
          this.generateDishIngredients(dish);
        }
      };

      this.chefSubmitBtn.addEventListener('click', submitHandler);
      this.chefDishInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitHandler();
      });
    }

    // Quick chips
    document.querySelectorAll('.chef-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const dish = e.currentTarget.getAttribute('data-dish');
        if (dish) {
          if (this.chefDishInput) this.chefDishInput.value = dish;
          this.generateDishIngredients(dish);
        }
      });
    });

    // Suggest from cart button
    if (this.chefSuggestFromCartBtn) {
      this.chefSuggestFromCartBtn.addEventListener('click', () => {
        this.suggestFromCurrentCart();
      });
    }

    // Back button in results
    if (this.chefBackBtn) {
      this.chefBackBtn.addEventListener('click', () => {
        this.showInputState();
      });
    }

    // Back button in suggestions
    if (this.chefSuggestionsBackBtn) {
      this.chefSuggestionsBackBtn.addEventListener('click', () => {
        this.showInputState();
      });
    }

    // Select all / deselect all in results
    if (this.chefSelectAllBtn) {
      this.chefSelectAllBtn.addEventListener('click', () => {
        const checkboxes = this.chefIngredientsList.querySelectorAll('input[type="checkbox"]');
        const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
        checkboxes.forEach(cb => { cb.checked = anyUnchecked; });
        this.chefSelectAllBtn.textContent = anyUnchecked ? 'Снять все' : 'Выбрать все';
        this.updateAddButtonState();
      });
    }

    // Add selected ingredients to main shopping list
    if (this.chefAddSelectedBtn) {
      this.chefAddSelectedBtn.addEventListener('click', () => {
        this.addSelectedIngredients();
      });
    }
  }

  open(dishName = '') {
    if (window.soundEffects) {
      window.soundEffects.vibrate(25);
    }

    this.showInputState();
    if (this.chefModal) {
      this.chefModal.classList.add('active');
    }

    if (dishName) {
      if (this.chefDishInput) this.chefDishInput.value = dishName;
      this.generateDishIngredients(dishName);
    } else {
      setTimeout(() => {
        if (this.chefDishInput) this.chefDishInput.focus();
      }, 300);
    }
  }

  close() {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.chefModal) {
      this.chefModal.classList.remove('active');
    }
  }

  showInputState() {
    if (this.chefInputSection) this.chefInputSection.style.display = 'block';
    if (this.chefLoadingState) this.chefLoadingState.style.display = 'none';
    if (this.chefResultsState) this.chefResultsState.style.display = 'none';
    if (this.chefSuggestionsState) this.chefSuggestionsState.style.display = 'none';
  }

  showLoading(text = 'Шеф составляет рецепт и список продуктов...') {
    if (this.chefInputSection) this.chefInputSection.style.display = 'none';
    if (this.chefLoadingState) this.chefLoadingState.style.display = 'block';
    if (this.chefLoadingText) this.chefLoadingText.textContent = text;
    if (this.chefResultsState) this.chefResultsState.style.display = 'none';
    if (this.chefSuggestionsState) this.chefSuggestionsState.style.display = 'none';
  }

  async generateDishIngredients(dishName) {
    if (!dishName || !dishName.trim()) return;
    const cleanLower = dishName.trim().toLowerCase();

    // 1. Check for INSTANT preloaded recipe (zero network latency, works 100% offline!)
    for (const [key, preloadedData] of Object.entries(PRELOADED_RECIPES)) {
      if (cleanLower.includes(key)) {
        this.renderIngredientsResult(preloadedData);
        return;
      }
    }

    // 2. Otherwise, fetch from AI Chef backend with strict 9s timeout
    this.showLoading(`Шеф подбирает продукты для «${dishName.trim()}»...`);

    try {
      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => this.abortController.abort(), 28000);

      const resp = await fetch('/api/chef', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish: dishName.trim(),
          servings: 4,
          mode: 'ingredients'
        }),
        signal: this.abortController.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка сервера (${resp.status})`);
      }

      const result = await resp.json();
      if (result && result.success && result.data && Array.isArray(result.data.ingredients)) {
        this.renderIngredientsResult(result.data);
      } else {
        throw new Error('Не удалось получить список ингредиентов от ИИ');
      }
    } catch (err) {
      console.error('Chef error:', err);
      if (err.name === 'AbortError') {
        alert('Шеф-сервер отвечает дольше обычного. Попробуйте еще раз или выберите одно из популярных блюд!');
      } else {
        alert('Ошибка ИИ-шефа: ' + (err.message || 'Попробуйте еще раз'));
      }
      this.showInputState();
    }
  }

  renderIngredientsResult(data) {
    this.currentDishData = data;
    this.extractedIngredients = data.ingredients || [];

    if (this.chefInputSection) this.chefInputSection.style.display = 'none';
    if (this.chefLoadingState) this.chefLoadingState.style.display = 'none';
    if (this.chefSuggestionsState) this.chefSuggestionsState.style.display = 'none';
    if (this.chefResultsState) this.chefResultsState.style.display = 'flex';

    if (this.chefDishTitle) this.chefDishTitle.textContent = data.dishTitle || 'Блюдо';
    if (this.chefCookTime) this.chefCookTime.textContent = data.cookTime ? `⏱️ ${data.cookTime}` : '';
    if (this.chefTipText) {
      this.chefTipText.textContent = data.tip ? `💡 Совет шефа: ${data.tip}` : '';
      this.chefTipText.style.display = data.tip ? 'block' : 'none';
    }

    if (this.chefIngCountText) {
      this.chefIngCountText.textContent = `Ингредиенты: ${this.extractedIngredients.length}`;
    }

    if (!this.chefIngredientsList) return;
    this.chefIngredientsList.innerHTML = '';

    this.extractedIngredients.forEach((item, index) => {
      const cat = window.CATEGORIES && window.CATEGORIES[item.category]
        ? window.CATEGORIES[item.category]
        : { icon: '🛒', name: 'Разное' };

      const row = document.createElement('label');
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        background: var(--bg-card);
        border: 1.5px solid var(--border-card);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 0.15s ease;
      `;

      const priceBadge = item.price
        ? `<span class="item-price-badge" style="font-size: 0.78rem; padding: 2px 7px;">${this.app.formatPrice(item.price)}</span>`
        : '';

      const qtyBadge = item.quantity
        ? `<span class="item-quantity-badge" style="background: var(--primary-subtle); color: var(--primary); padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.78rem; font-weight: 700;">${this.escapeHtml(item.quantity)}</span>`
        : '';

      row.innerHTML = `
        <input type="checkbox" checked data-index="${index}" style="width: 18px; height: 18px; accent-color: var(--primary);">
        <span style="font-size: 1.2rem;">${cat.icon}</span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${this.escapeHtml(item.title)}</div>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${cat.name}</div>
        </div>
        ${priceBadge}
        ${qtyBadge}
      `;

      const cb = row.querySelector('input[type="checkbox"]');
      cb.addEventListener('change', () => {
        this.updateAddButtonState();
      });

      this.chefIngredientsList.appendChild(row);
    });

    this.updateAddButtonState();
    if (window.soundEffects) {
      window.soundEffects.vibrate(30);
    }
  }

  updateAddButtonState() {
    if (!this.chefAddSelectedBtn || !this.chefIngredientsList) return;
    const checked = this.chefIngredientsList.querySelectorAll('input[type="checkbox"]:checked');
    const count = checked.length;
    this.chefAddSelectedBtn.textContent = count > 0
      ? `✅ Добавить (${count}) в список`
      : 'Выберите продукты';
    this.chefAddSelectedBtn.disabled = count === 0;
    this.chefAddSelectedBtn.style.opacity = count === 0 ? '0.5' : '1';
  }

  addSelectedIngredients() {
    if (!this.chefIngredientsList) return;
    const checkboxes = this.chefIngredientsList.querySelectorAll('input[type="checkbox"]:checked');
    const toAdd = [];

    checkboxes.forEach(cb => {
      const idx = parseInt(cb.getAttribute('data-index'), 10);
      const ing = this.extractedIngredients[idx];
      if (ing) {
        toAdd.push({
          id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          title: ing.title,
          quantity: ing.quantity || '',
          price: ing.price ? Number(ing.price) : null,
          category: ing.category || 'grocery',
          completed: false,
          createdAt: Date.now()
        });
        // Save price in price history
        if (ing.price) {
          this.app.savePriceHistory(ing.title, ing.price);
        }
      }
    });

    if (toAdd.length === 0) return;

    this.app.items = [...toAdd, ...this.app.items];
    this.app.saveItems();
    this.app.render();

    if (window.soundEffects) {
      window.soundEffects.playItemAdded();
      window.soundEffects.speak(`Добавил ингредиенты для ${this.currentDishData?.dishTitle || 'блюда'}`);
    }

    this.app.showToast(`👨‍🍳 Добавлено товаров: ${toAdd.length}`);
    this.close();
  }

  async suggestFromCurrentCart() {
    const itemTitles = this.app.items.map(i => i.title);
    if (itemTitles.length === 0) {
      alert('Список покупок пока пуст. Добавьте хотя бы 2-3 товара или выберите блюдо сверху!');
      return;
    }

    this.showLoading('Шеф придумывает блюда из ваших продуктов...');

    try {
      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => this.abortController.abort(), 28000);

      const resp = await fetch('/api/chef', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'suggest_from_items',
          items: itemTitles
        }),
        signal: this.abortController.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка сервера (${resp.status})`);
      }

      const result = await resp.json();
      const suggestions = result?.data?.suggestions;
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        this.renderSuggestions(suggestions);
      } else {
        throw new Error('ИИ не смог подобрать рецепт, попробуйте другое сочетание продуктов');
      }
    } catch (err) {
      console.error('Suggest error:', err);
      if (err.name === 'AbortError') {
        alert('Шеф-сервер отвечает дольше обычного. Попробуйте еще раз!');
      } else {
        alert('Ошибка ИИ-шефа: ' + (err.message || 'Попробуйте позже'));
      }
      this.showInputState();
    }
  }

  renderSuggestions(suggestions) {
    if (this.chefInputSection) this.chefInputSection.style.display = 'none';
    if (this.chefLoadingState) this.chefLoadingState.style.display = 'none';
    if (this.chefResultsState) this.chefResultsState.style.display = 'none';
    if (this.chefSuggestionsState) this.chefSuggestionsState.style.display = 'flex';

    if (!this.chefSuggestionsList) return;
    this.chefSuggestionsList.innerHTML = '';

    suggestions.forEach(item => {
      const card = document.createElement('div');
      card.style.cssText = `
        background: var(--bg-card);
        border: 1.5px solid var(--border-card);
        border-radius: var(--radius-md);
        padding: 12px;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 6px;
      `;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 1rem; color: #ea580c;">🍽️ ${this.escapeHtml(item.dishTitle)}</strong>
          <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary);">${this.escapeHtml(item.cookTime || '')}</span>
        </div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.35;">
          ${this.escapeHtml(item.description || '')}
        </div>
        <button type="button" class="btn-cook-this" style="margin-top: 6px; padding: 8px 12px; border-radius: var(--radius-sm); border: none; background: #ea580c; color: white; font-weight: 700; font-size: 0.84rem; cursor: pointer;">
          🍳 Получить список ингредиентов
        </button>
      `;

      const btn = card.querySelector('.btn-cook-this');
      btn.addEventListener('click', () => {
        this.generateDishIngredients(item.dishTitle);
      });

      this.chefSuggestionsList.appendChild(card);
    });

    if (window.soundEffects) {
      window.soundEffects.vibrate(30);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.ChefManager = ChefManager;
