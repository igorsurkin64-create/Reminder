// Hybrid OCR Camera Scanner: Google Gemini AI Vision (Handwritten) + Tesseract.js (Printed)

class GroceryOcrScanner {
  constructor(app) {
    this.app = app;
    this.extractedItems = [];
    this.ocrEngine = localStorage.getItem('shopping_ocr_engine') || 'gemini'; // 'gemini' or 'tesseract'
    this.geminiApiKey = localStorage.getItem('shopping_gemini_api_key') || '';
    this.pendingFile = null;

    this.initElements();
    this.initEventListeners();
    this.updateEngineUi();
  }

  initElements() {
    this.cameraInput = document.getElementById('cameraInput');
    this.cameraBtn = document.getElementById('cameraBtn');
    this.dockCameraBtn = document.getElementById('dockCameraBtn');

    // Modal elements
    this.ocrModal = document.getElementById('ocrModal');
    this.closeOcrBtn = document.getElementById('closeOcrBtn');
    this.ocrModalTitle = document.getElementById('ocrModalTitle');

    // Engine switcher & prompt
    this.ocrEngineGeminiBtn = document.getElementById('ocrEngineGeminiBtn');
    this.ocrEngineTesseractBtn = document.getElementById('ocrEngineTesseractBtn');
    this.geminiKeyPromptBlock = document.getElementById('geminiKeyPromptBlock');
    this.geminiKeyInput = document.getElementById('geminiKeyInput');
    this.saveGeminiKeyBtn = document.getElementById('saveGeminiKeyBtn');
    this.switchToTesseractBtn = document.getElementById('switchToTesseractBtn');

    // Scanning state
    this.ocrScanningState = document.getElementById('ocrScanningState');
    this.ocrPreviewImg = document.getElementById('ocrPreviewImg');
    this.ocrStatusText = document.getElementById('ocrStatusText');
    this.ocrProgressFill = document.getElementById('ocrProgressFill');
    this.ocrPercentText = document.getElementById('ocrPercentText');

    // Results state
    this.ocrResultsState = document.getElementById('ocrResultsState');
    this.ocrFoundCountText = document.getElementById('ocrFoundCountText');
    this.ocrSelectAllBtn = document.getElementById('ocrSelectAllBtn');
    this.ocrItemsList = document.getElementById('ocrItemsList');
    this.ocrRetakeBtn = document.getElementById('ocrRetakeBtn');
    this.ocrAddSelectedBtn = document.getElementById('ocrAddSelectedBtn');
  }

  initEventListeners() {
    const triggerCamera = () => {
      if (this.cameraInput) {
        this.cameraInput.value = '';
        this.cameraInput.click();
      }
    };

    if (this.cameraBtn) this.cameraBtn.addEventListener('click', triggerCamera);
    if (this.dockCameraBtn) this.dockCameraBtn.addEventListener('click', triggerCamera);

    if (this.cameraInput) {
      this.cameraInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          this.pendingFile = file;
          this.processImageFile(file);
        }
      });
    }

    if (this.closeOcrBtn) {
      this.closeOcrBtn.addEventListener('click', () => this.closeModal());
    }

    if (this.ocrModal) {
      this.ocrModal.addEventListener('click', (e) => {
        if (e.target === this.ocrModal) this.closeModal();
      });
    }

    // Engine switcher events
    if (this.ocrEngineGeminiBtn) {
      this.ocrEngineGeminiBtn.addEventListener('click', () => {
        this.ocrEngine = 'gemini';
        localStorage.setItem('shopping_ocr_engine', 'gemini');
        this.updateEngineUi();
        if (this.pendingFile && this.geminiApiKey) {
          this.processImageFile(this.pendingFile);
        }
      });
    }

    if (this.ocrEngineTesseractBtn) {
      this.ocrEngineTesseractBtn.addEventListener('click', () => {
        this.ocrEngine = 'tesseract';
        localStorage.setItem('shopping_ocr_engine', 'tesseract');
        this.updateEngineUi();
        if (this.pendingFile) {
          this.processImageFile(this.pendingFile);
        }
      });
    }

    if (this.switchToTesseractBtn) {
      this.switchToTesseractBtn.addEventListener('click', () => {
        this.ocrEngine = 'tesseract';
        localStorage.setItem('shopping_ocr_engine', 'tesseract');
        this.updateEngineUi();
        if (this.pendingFile) {
          this.processImageFile(this.pendingFile);
        }
      });
    }

    if (this.saveGeminiKeyBtn) {
      this.saveGeminiKeyBtn.addEventListener('click', () => {
        const key = this.geminiKeyInput ? this.geminiKeyInput.value.trim() : '';
        if (!key) {
          this.app.showToast('⚠️ Введите API-ключ Google AI');
          return;
        }
        this.geminiApiKey = key;
        localStorage.setItem('shopping_gemini_api_key', key);
        this.app.showToast('✅ Ключ ИИ сохранён!');
        this.updateEngineUi();
        if (this.pendingFile) {
          this.processImageFile(this.pendingFile);
        }
      });
    }

    if (this.ocrRetakeBtn) {
      this.ocrRetakeBtn.addEventListener('click', triggerCamera);
    }

    if (this.ocrSelectAllBtn) {
      this.ocrSelectAllBtn.addEventListener('click', () => {
        const checkboxes = this.ocrItemsList.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
        this.ocrSelectAllBtn.textContent = allChecked ? 'Выбрать все' : 'Снять все';
        this.updateAddButtonState();
      });
    }

    if (this.ocrAddSelectedBtn) {
      this.ocrAddSelectedBtn.addEventListener('click', () => this.addSelectedItems());
    }
  }

  updateEngineUi() {
    const isGemini = this.ocrEngine === 'gemini';
    if (this.ocrEngineGeminiBtn) {
      this.ocrEngineGeminiBtn.style.background = isGemini ? '#6366f1' : 'var(--bg-card)';
      this.ocrEngineGeminiBtn.style.color = isGemini ? 'white' : 'var(--text-primary)';
      this.ocrEngineGeminiBtn.style.borderColor = isGemini ? '#6366f1' : 'var(--border-card)';
    }
    if (this.ocrEngineTesseractBtn) {
      this.ocrEngineTesseractBtn.style.background = !isGemini ? 'var(--primary)' : 'var(--bg-card)';
      this.ocrEngineTesseractBtn.style.color = !isGemini ? 'white' : 'var(--text-primary)';
      this.ocrEngineTesseractBtn.style.borderColor = !isGemini ? 'var(--primary)' : 'var(--border-card)';
    }

    // Show Gemini key config prompt if Gemini is selected and key is empty
    if (this.geminiKeyPromptBlock) {
      const needsKey = isGemini && !this.geminiApiKey;
      this.geminiKeyPromptBlock.style.display = needsKey ? 'block' : 'none';
      if (needsKey && this.geminiKeyInput) {
        this.geminiKeyInput.value = this.geminiApiKey || '';
      }
    }
  }

  closeModal() {
    if (this.ocrModal) {
      this.ocrModal.classList.remove('active');
    }
  }

  // Preprocess image on canvas: scale to max 1600px, prepare base64
  async preprocessImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let w = img.width;
          let h = img.height;
          const scale = Math.min(1, maxDim / Math.max(w, h));
          w = Math.round(w * scale);
          h = Math.round(h * scale);

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          const base64Jpeg = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
          resolve({ canvas, previewUrl: e.target.result, base64Jpeg });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async processImageFile(file) {
    if (!this.ocrModal) return;

    // Show modal
    this.ocrModal.classList.add('active');
    this.ocrScanningState.style.display = 'block';
    this.ocrResultsState.style.display = 'none';
    this.ocrModalTitle.textContent = 'Сканирование списка';
    this.updateEngineUi();

    // If Gemini is selected and no key, stop and let user enter key
    if (this.ocrEngine === 'gemini' && !this.geminiApiKey) {
      this.ocrScanningState.style.display = 'none';
      return;
    }

    this.ocrStatusText.textContent = 'Подготовка фотографии...';
    this.ocrProgressFill.style.width = '15%';
    this.ocrPercentText.textContent = '15%';

    try {
      const { canvas, previewUrl, base64Jpeg } = await this.preprocessImage(file);
      if (this.ocrPreviewImg) {
        this.ocrPreviewImg.src = previewUrl;
      }

      if (this.ocrEngine === 'gemini') {
        await this.runGeminiRecognition(base64Jpeg);
      } else {
        await this.runTesseractRecognition(canvas);
      }
    } catch (err) {
      console.error('Recognition error:', err);
      this.ocrStatusText.textContent = 'Ошибка: ' + (err.message || 'попробуйте ещё раз');
      this.app.showToast('⚠️ Ошибка распознавания: ' + (err.message || 'проверьте фото или ключ'));
    }
  }

  // AI Gemini Vision (Reads any handwriting & cursive)
  async runGeminiRecognition(base64Jpeg) {
    this.ocrStatusText.textContent = '🧠 ИИ расшифровывает рукописный почерк...';
    this.ocrProgressFill.style.width = '55%';
    this.ocrPercentText.textContent = '55%';

    const prompt = `Внимательно прочитай эту рукописную или напечатанную записку списка покупок.
Почерк может быть сложным, неразборчивым или беглым — используй логику продуктового супермаркета, чтобы понять слова (например "колб." -> "Колбаса", "молочк." -> "Молоко").
Если пункт зачёркнут ручкой — пропусти его (он уже куплен).
Нормализуй падеж в именительный (например "сметаны" -> "Сметана", "колбасу" -> "Колбаса").
Отдели количество (например "1 кг", "300 г", "2 шт", "1 пачка"), если оно есть.

Верни ТОЛЬКО валидный JSON массив объектов:
[
  {
    "title": "Колбаса докторская",
    "quantity": "500 г",
    "category": "meat"
  }
]
Категории (category) строго: dairy, produce, meat, bakery, grocery, drinks, sweets, household, other.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(this.geminiApiKey.trim())}`;
    const body = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Jpeg
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
      throw new Error(errJson.error?.message || `Ошибка API (${response.status})`);
    }

    this.ocrProgressFill.style.width = '95%';
    this.ocrPercentText.textContent = '95%';

    const data = await response.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleanJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsedList = [];
    try {
      parsedList = JSON.parse(cleanJson);
    } catch (e) {
      console.warn('JSON parse fallback:', e);
      parsedList = [];
    }

    this.extractedItems = parsedList.map((it, idx) => ({
      id: 'item_ai_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 4),
      title: it.title ? (it.title.charAt(0).toUpperCase() + it.title.slice(1)) : 'Товар',
      quantity: it.quantity || '',
      category: it.category || 'other',
      completed: false,
      createdAt: Date.now() + idx
    }));

    this.showResults();
  }

  // Tesseract OCR (For printed receipts / packaging)
  async runTesseractRecognition(canvas) {
    if (!window.Tesseract) {
      this.ocrStatusText.textContent = 'Загрузка OCR-модуля...';
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error('Не удалось загрузить OCR'));
        document.head.appendChild(script);
      });
    }

    this.ocrStatusText.textContent = 'Распознаю печатный текст...';
    const worker = await Tesseract.createWorker('rus', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(25 + m.progress * 70);
          this.ocrProgressFill.style.width = `${pct}%`;
          this.ocrPercentText.textContent = `${pct}%`;
        }
      }
    });

    const ret = await worker.recognize(canvas);
    await worker.terminate();

    const rawText = ret.data.text || '';
    const lines = rawText.split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const items = [];
    for (const line of lines) {
      let cleaned = line.replace(/^[\s\d\-•*.)]+\s*/, '').trim();
      if (cleaned.length < 2) continue;
      if (/^(список|покупки|купить|чек|итог|руб)\b/i.test(cleaned)) continue;

      if (window.GroceryParser) {
        const parsed = window.GroceryParser.parse(cleaned);
        if (parsed && parsed.length > 0) {
          items.push(...parsed);
        }
      }
    }

    this.extractedItems = items;
    this.showResults();
  }

  showResults() {
    this.ocrScanningState.style.display = 'none';
    this.ocrResultsState.style.display = 'flex';
    this.ocrModalTitle.textContent = 'Найденные товары';
    this.renderOcrItems();
  }

  renderOcrItems() {
    if (!this.ocrItemsList) return;
    this.ocrItemsList.innerHTML = '';

    if (this.extractedItems.length === 0) {
      this.ocrItemsList.innerHTML = `
        <div style="text-align: center; padding: 24px 10px; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">Товары не распознаны</div>
          <div style="font-size: 0.82rem;">Для рукописного почерка используйте кнопку 🧠 «ИИ-зрение» вверху с бесплатным ключом Google.</div>
        </div>
      `;
      this.ocrFoundCountText.textContent = 'Найдено товаров: 0';
      if (this.ocrAddSelectedBtn) this.ocrAddSelectedBtn.style.display = 'none';
      if (this.ocrSelectAllBtn) this.ocrSelectAllBtn.style.display = 'none';
      return;
    }

    if (this.ocrAddSelectedBtn) this.ocrAddSelectedBtn.style.display = 'block';
    if (this.ocrSelectAllBtn) this.ocrSelectAllBtn.style.display = 'inline-block';
    this.ocrFoundCountText.textContent = `Найдено товаров: ${this.extractedItems.length}`;

    this.extractedItems.forEach((item, index) => {
      const cat = window.CATEGORIES && window.CATEGORIES[item.category] 
        ? window.CATEGORIES[item.category] 
        : { icon: '🛒', name: 'Разное' };

      const row = document.createElement('label');
      row.className = 'ocr-item-row';
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        background: var(--bg-card);
        border: 1.5px solid var(--border-card);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 0.2s ease;
      `;

      row.innerHTML = `
        <input type="checkbox" checked data-index="${index}" style="width: 20px; height: 20px; accent-color: var(--primary);">
        <span style="font-size: 1.3rem;">${cat.icon}</span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${this.escapeHtml(item.title)}</div>
          <div style="font-size: 0.76rem; color: var(--text-secondary);">${cat.name}</div>
        </div>
        ${item.quantity ? `<span class="item-quantity-badge" style="background: var(--primary-subtle); color: var(--primary); padding: 3px 8px; border-radius: var(--radius-full); font-size: 0.78rem; font-weight: 700;">${this.escapeHtml(item.quantity)}</span>` : ''}
        <button type="button" class="ocr-remove-item" data-index="${index}" style="background: none; border: none; font-size: 1.1rem; color: var(--text-muted); cursor: pointer; padding: 4px;" title="Удалить">&times;</button>
      `;

      const removeBtn = row.querySelector('.ocr-remove-item');
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.extractedItems.splice(index, 1);
        this.renderOcrItems();
      });

      const checkbox = row.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', () => {
        this.updateAddButtonState();
      });

      this.ocrItemsList.appendChild(row);
    });

    this.updateAddButtonState();
  }

  updateAddButtonState() {
    if (!this.ocrAddSelectedBtn || !this.ocrItemsList) return;
    const checked = this.ocrItemsList.querySelectorAll('input[type="checkbox"]:checked');
    const count = checked.length;
    this.ocrAddSelectedBtn.textContent = count > 0 
      ? `✅ Добавить (${count}) в список` 
      : 'Выберите товары';
    this.ocrAddSelectedBtn.disabled = count === 0;
    this.ocrAddSelectedBtn.style.opacity = count === 0 ? '0.5' : '1';
  }

  addSelectedItems() {
    if (!this.ocrItemsList) return;
    const checkboxes = this.ocrItemsList.querySelectorAll('input[type="checkbox"]:checked');
    const toAdd = [];

    checkboxes.forEach(cb => {
      const idx = parseInt(cb.getAttribute('data-index'), 10);
      if (this.extractedItems[idx]) {
        toAdd.push(this.extractedItems[idx]);
      }
    });

    if (toAdd.length === 0) return;

    this.app.items = [...toAdd, ...this.app.items];
    this.app.saveItems();
    this.app.render();

    if (window.soundEffects) {
      window.soundEffects.playItemAdded();
    }
    const decl = this.app.declension(toAdd.length, ['товар', 'товара', 'товаров']);
    this.app.showToast(`📸 Добавлено с фото: ${toAdd.length} ${decl}!`);

    this.closeModal();
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

window.GroceryOcrScanner = GroceryOcrScanner;
