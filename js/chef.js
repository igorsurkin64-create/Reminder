// AI Chef Manager: Generates grocery recipe ingredients and suggests meals from cart items

class ChefManager {
  constructor(app) {
    this.app = app;
    this.extractedIngredients = [];
    this.currentDishData = null;

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

    this.showLoading(`Шеф подбирает продукты для «${dishName.trim()}»...`);

    try {
      const clientKey = localStorage.getItem('shopping_gemini_api_key') || '';
      const resp = await fetch('/api/chef', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish: dishName.trim(),
          servings: 4,
          mode: 'ingredients',
          clientApiKey: clientKey
        })
      });

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
      alert('Ошибка ИИ-шефа: ' + (err.message || 'Попробуйте еще раз'));
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
      alert('Список покупок пока пуст. Добавьте хотя бы 2-3 товара или введите название любого блюда сверху!');
      return;
    }

    this.showLoading('Шеф придумывает блюда из ваших продуктов...');

    try {
      const clientKey = localStorage.getItem('shopping_gemini_api_key') || '';
      const resp = await fetch('/api/chef', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'suggest_from_items',
          items: itemTitles,
          clientApiKey: clientKey
        })
      });

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
      alert('Ошибка ИИ-шефа: ' + (err.message || 'Попробуйте позже'));
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
