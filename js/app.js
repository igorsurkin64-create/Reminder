// Main Shopping List Application Logic

class ShoppingApp {
  constructor() {
    this.items = this.loadItems();
    this.currentFilter = 'all'; // 'all', 'active', 'completed'
    this.groupByCategory = true;
    this.deferredInstallPrompt = null;

    this.initElements();
    this.initEventListeners();
    this.initVoice();
    this.initOcr();
    this.initPWA();
    this.initSync();
    this.initWakeLock();
    this.initKeyboardHandling();
    this.render();
  }

  initSync() {
    if (window.FamilySyncManager) {
      this.syncManager = new window.FamilySyncManager(this);
    }
  }

  // Keep screen awake in supermarket (Screen Wake Lock API)
  initWakeLock() {
    this.wakeLockSentinel = null;
    this.isRequestingWakeLock = false;
    this.updateWakeLockUi();

    if (this.wakeLockEnabled) {
      this.requestWakeLock();
    }

    // Re-acquire only if user still wants it enabled when app comes to foreground:
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (this.wakeLockEnabled) {
          this.requestWakeLock();
        } else {
          this.releaseWakeLock();
        }
      }
    });
  }

  async requestWakeLock() {
    if (!this.wakeLockEnabled || !('wakeLock' in navigator)) return;
    if (this.isRequestingWakeLock) return;
    if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
      this.updateWakeLockUi();
      return;
    }

    this.isRequestingWakeLock = true;
    try {
      const sentinel = await navigator.wakeLock.request('screen');

      // If user disabled it while awaiting request, release immediately!
      if (!this.wakeLockEnabled) {
        try { await sentinel.release(); } catch (e) {}
        this.wakeLockSentinel = null;
        this.updateWakeLockUi();
        return;
      }

      this.wakeLockSentinel = sentinel;
      this.wakeLockSentinel.addEventListener('release', () => {
        if (this.wakeLockSentinel === sentinel) {
          this.wakeLockSentinel = null;
          this.updateWakeLockUi();
        }
      });
      this.updateWakeLockUi();
    } catch (err) {
      console.warn('Wake Lock request error:', err.message);
      this.wakeLockSentinel = null;
      this.updateWakeLockUi();
    } finally {
      this.isRequestingWakeLock = false;
    }
  }

  async releaseWakeLock() {
    this.wakeLockEnabled = false;
    localStorage.setItem('shopping_wake_lock', 'false');

    if (this.wakeLockSentinel) {
      try {
        const sentinel = this.wakeLockSentinel;
        this.wakeLockSentinel = null;
        await sentinel.release();
      } catch (e) {
        console.warn('Wake Lock release error:', e);
      }
    }
    this.wakeLockSentinel = null;
    this.updateWakeLockUi();
  }

  toggleWakeLock(notify = true) {
    if (this.wakeLockEnabled) {
      // Turn OFF -> screen sleeps normally
      this.releaseWakeLock();
      if (notify) this.showToast('💤 Экран гаснет в обычном режиме');
      if (window.soundEffects) window.soundEffects.triggerHaptic([20]);
    } else {
      // Turn ON -> screen stays awake
      this.wakeLockEnabled = true;
      localStorage.setItem('shopping_wake_lock', 'true');
      this.requestWakeLock();
      if (notify) this.showToast('🔆 Режим магазина: экран не будет гаснуть');
      if (window.soundEffects) window.soundEffects.triggerHaptic([35]);
    }
    this.updateWakeLockUi();
  }

  updateWakeLockUi() {
    const isActive = !!this.wakeLockEnabled;

    if (this.wakeLockBtn) {
      this.wakeLockBtn.classList.toggle('wake-active', isActive);
      this.wakeLockBtn.title = isActive
        ? 'Экран не гаснет в магазине (нажмите, чтобы выключить)'
        : 'Экран гаснет как обычно (нажмите, чтобы включить режим магазина)';
    }

    if (this.wakeLockIcon) {
      this.wakeLockIcon.textContent = isActive ? '🔆' : '💤';
    }

    if (this.wakeLockCheckbox) {
      this.wakeLockCheckbox.checked = isActive;
    }
  }

  initKeyboardHandling() {
    if (window.visualViewport) {
      const onViewportChange = () => {
        const vv = window.visualViewport;
        const windowHeight = window.innerHeight;
        const keyboardHeight = Math.max(0, windowHeight - vv.height - (vv.offsetTop || 0));

        document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(keyboardHeight)}px`);
        document.body.classList.toggle('keyboard-visible', keyboardHeight > 60);

        if (keyboardHeight > 60) {
          const activeEl = document.activeElement;
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            setTimeout(() => {
              activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 80);
          }
        }
      };

      window.visualViewport.addEventListener('resize', onViewportChange);
      window.visualViewport.addEventListener('scroll', onViewportChange);
    }

    // Auto-scroll input into view when focused
    document.addEventListener('focusin', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 280);
      }
    });

    // Reset keyboard inset when user taps away from inputs
    document.addEventListener('focusout', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          const active = document.activeElement;
          if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
            document.documentElement.style.setProperty('--keyboard-inset', '0px');
            document.body.classList.remove('keyboard-visible');
          }
        }, 150);
      }
    });
  }

  initOcr() {
    if (window.GroceryOcrScanner) {
      this.ocrScanner = new window.GroceryOcrScanner(this);
    }
  }

  loadItems() {
    try {
      const saved = localStorage.getItem('shopping_items_v1');
      if (saved) {
        const items = JSON.parse(saved);
        const expanded = [];
        items.forEach(i => {
          if (typeof i.title === 'string') {
            if (/^(?:я\s+)?(?:хочу\s+)?(?:добавить|купить)\s+/i.test(i.title)) {
              i.title = window.GroceryParser.cleanInput(i.title);
              i.title = window.GroceryParser.normalizeTitle(i.title);
            }
            i.title = window.GroceryParser.cleanFillers(i.title);

            // Automatically split any accidentally combined items (like "Сосиски курица")
            if (window.GroceryParser) {
              const multi = window.GroceryParser.parse(i.title);
              if (multi.length > 1) {
                multi.forEach((sub, idx) => {
                  expanded.push({
                    id: 'item_split_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 4),
                    title: sub.title,
                    quantity: sub.quantity || i.quantity || '',
                    category: sub.category || i.category,
                    completed: i.completed || false,
                    createdAt: (i.createdAt || Date.now()) + idx
                  });
                });
                return;
              }
            }
          }
          expanded.push(i);
        });
        return expanded;
      }
    } catch (e) {
      console.error('Error loading items from localStorage', e);
    }
    // Default starter items if empty
    return [
      {
        id: 'item_init_1',
        title: 'Молоко 3.2%',
        quantity: '1 л',
        category: 'dairy',
        completed: false,
        createdAt: Date.now() - 300000
      },
      {
        id: 'item_init_2',
        title: 'Бананы',
        quantity: '1 кг',
        category: 'produce',
        completed: false,
        createdAt: Date.now() - 200000
      },
      {
        id: 'item_init_3',
        title: 'Хлеб бородинский',
        quantity: '1 бух.',
        category: 'bakery',
        completed: true,
        createdAt: Date.now() - 100000
      }
    ];
  }

  saveItems(actionDetail = 'Обновление списка') {
    try {
      localStorage.setItem('shopping_items_v1', JSON.stringify(this.items));
      if (this.syncManager) {
        this.syncManager.broadcastItems(actionDetail);
      }
    } catch (e) {
      console.error('Error saving items to localStorage', e);
    }
  }

  initElements() {
    this.itemsContainer = document.getElementById('itemsContainer');
    this.emptyState = document.getElementById('emptyState');
    this.textInput = document.getElementById('itemInput');
    this.addBtn = document.getElementById('addBtn');
    this.micBtn = document.getElementById('micBtn');
    this.fabMicBtn = document.getElementById('fabMicBtn');
    this.totalCountEl = document.getElementById('totalCount');
    this.progressFillEl = document.getElementById('progressFill');
    this.progressTextEl = document.getElementById('progressText');

    // Voice Modal
    this.voiceModal = document.getElementById('voiceModal');
    this.voiceStatus = document.getElementById('voiceStatus');
    this.voiceTranscript = document.getElementById('voiceTranscript');
    this.closeVoiceBtn = document.getElementById('closeVoiceBtn');
    this.voiceWaves = document.getElementById('voiceWaves');

    // Filter Buttons
    this.filterBtns = document.querySelectorAll('.filter-pill, .filter-btn');

    // Voice Toggle
    this.voiceToggleBtn = document.getElementById('voiceToggleBtn');
    this.voiceIcon = document.getElementById('voiceIcon');
    if (this.voiceIcon && window.soundEffects) {
      this.voiceIcon.textContent = window.soundEffects.voiceEnabled ? '🔊' : '🔇';
    }

    // Theme Toggle
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeIcon = document.getElementById('themeIcon');
    this.initTheme();

    // Clear and Share Buttons
    this.clearCompletedBtn = document.getElementById('clearCompletedBtn');
    this.clearModal = document.getElementById('clearModal');
    this.closeClearModalBtn = document.getElementById('closeClearModalBtn');
    this.clearOnlyCompletedBtn = document.getElementById('clearOnlyCompletedBtn');
    this.clearOnlyCompletedBadge = document.getElementById('clearOnlyCompletedBadge');
    this.clearOnlyCompletedSubtext = document.getElementById('clearOnlyCompletedSubtext');
    this.clearEverythingBtn = document.getElementById('clearEverythingBtn');
    this.clearEverythingBadge = document.getElementById('clearEverythingBadge');
    this.cancelClearBtn = document.getElementById('cancelClearBtn');

    this.shareBtn = document.getElementById('shareBtn');
    this.pwaInstallBanner = document.getElementById('pwaInstallBanner');
    this.installAppBtn = document.getElementById('installAppBtn');
    this.closeBannerBtn = document.getElementById('closeBannerBtn');
    this.openInstallBtn = document.getElementById('openInstallBtn');
    this.installModal = document.getElementById('installModal');
    this.closeInstallModalBtn = document.getElementById('closeInstallModalBtn');
    this.closeInstallModalBottomBtn = document.getElementById('closeInstallModalBottomBtn');
    this.nativePromptBtn = document.getElementById('nativePromptBtn');

    // Toast
    this.toastEl = document.getElementById('toast');

    // QR modal
    this.qrModal = document.getElementById('qrModal');
    this.openQrBtn = document.getElementById('openQrBtn');
    this.closeQrBtn = document.getElementById('closeQrBtn');

    // Voice settings modal elements
    this.openVoiceSettingsBtn = document.getElementById('openVoiceSettingsBtn');
    this.voiceSettingsModal = document.getElementById('voiceSettingsModal');
    this.closeVoiceSettingsBtn = document.getElementById('closeVoiceSettingsBtn');
    this.voiceSelect = document.getElementById('voiceSelect');
    this.voiceEnableCheckbox = document.getElementById('voiceEnableCheckbox');
    this.soundFxCheckbox = document.getElementById('soundFxCheckbox');
    this.hapticsCheckbox = document.getElementById('hapticsCheckbox');
    this.testVoiceBtn = document.getElementById('testVoiceBtn');

    // Wake Lock (Keep Screen Awake in Supermarket)
    this.wakeLockBtn = document.getElementById('wakeLockBtn');
    this.wakeLockIcon = document.getElementById('wakeLockIcon');
    this.wakeLockCheckbox = document.getElementById('wakeLockCheckbox');
    this.wakeLockSentinel = null;
    this.isRequestingWakeLock = false;
    // Default is false (normal phone screen timeout), enabled on user demand
    this.wakeLockEnabled = localStorage.getItem('shopping_wake_lock') === 'true';

    // Alice Voice settings elements
    this.engineAliceBtn = document.getElementById('engineAliceBtn');
    this.engineDeviceBtn = document.getElementById('engineDeviceBtn');
    this.aliceConfigBlock = document.getElementById('aliceConfigBlock');
    this.deviceVoiceBlock = document.getElementById('deviceVoiceBlock');
    this.yandexEmotionSelect = document.getElementById('yandexEmotionSelect');
    this.testAliceBtn = document.getElementById('testAliceBtn');

    // Status and celebration elements
    this.checkStatusBtn = document.getElementById('checkStatusBtn');
    this.checkStatusBtnText = document.getElementById('checkStatusBtnText');
    this.celebrationBanner = document.getElementById('celebrationBanner');
    this.progressCard = document.getElementById('progressCard');

    // Budget elements
    this.budgetBar = document.getElementById('budgetBar');
    this.budgetCartTotal = document.getElementById('budgetCartTotal');
    this.budgetLimitTrigger = document.getElementById('budgetLimitTrigger');
    this.budgetLimitValue = document.getElementById('budgetLimitValue');
    this.budgetPlanTotal = document.getElementById('budgetPlanTotal');
    this.budgetLimit = parseFloat(localStorage.getItem('shopping_budget_limit')) || null;

    // Currency settings (Default EUR € for Estonia/EU)
    this.currency = localStorage.getItem('shopping_currency') || 'EUR';
    this.currencySelect = document.getElementById('currencySelect');

    // Help modal elements
    this.openHelpBtn = document.getElementById('openHelpBtn');
    this.helpModal = document.getElementById('helpModal');
    this.closeHelpBtn = document.getElementById('closeHelpBtn');
    this.closeHelpBottomBtn = document.getElementById('closeHelpBottomBtn');

    // Empty state triggers
    this.emptyMicTrigger = document.getElementById('emptyMicTrigger');
    this.emptyChefTrigger = document.getElementById('emptyChefTrigger');
    this.emptyCameraTrigger = document.getElementById('emptyCameraTrigger');

    // Initialize AI Chef Manager
    if (window.ChefManager) {
      this.chefManager = new ChefManager(this);
    }
  }

  getCurrencySymbol() {
    if (this.currency === 'USD') return '$';
    if (this.currency === 'RUB') return '₽';
    return '€';
  }

  formatPrice(val) {
    if (val === null || val === undefined || isNaN(val)) return '';
    const num = Number(val);
    const symbol = this.getCurrencySymbol();
    const formatted = num % 1 === 0 ? num.toString() : num.toFixed(2).replace('.', ',');
    return `${formatted} ${symbol}`;
  }

  formatPriceForVoice(val) {
    const num = Number(val);
    if (isNaN(num)) return '';
    if (this.currency === 'EUR') {
      const euros = Math.floor(num);
      const cents = Math.round((num - euros) * 100);
      if (cents === 0) {
        return `${euros} ${this.declension(euros, ['евро', 'евро', 'евро'])}`;
      }
      if (euros === 0) {
        return `${cents} ${this.declension(cents, ['цент', 'цента', 'центов'])}`;
      }
      return `${euros} евро ${cents} ${this.declension(cents, ['цент', 'цента', 'центов'])}`;
    } else if (this.currency === 'USD') {
      return `${num} долларов`;
    } else {
      return `${Math.round(num)} ${this.declension(Math.round(num), ['рубль', 'рубля', 'рублей'])}`;
    }
  }

  populateVoiceSelect() {
    if (!this.voiceSelect) return;
    const voices = window.soundEffects.getAvailableVoices();
    this.voiceSelect.innerHTML = '<option value="">Автовыбор (лучший естественный)</option>';
    const savedURI = localStorage.getItem('shopping_voice_uri') || '';

    voices.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI || v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (opt.value === savedURI) {
        opt.selected = true;
      }
      this.voiceSelect.appendChild(opt);
    });
  }

  initTheme() {
    const savedTheme = localStorage.getItem('shopping_theme') || 'light';
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (this.themeIcon) this.themeIcon.textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (this.themeIcon) this.themeIcon.textContent = '🌙';
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('shopping_theme', 'light');
      if (this.themeIcon) this.themeIcon.textContent = '🌙';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('shopping_theme', 'dark');
      if (this.themeIcon) this.themeIcon.textContent = '☀️';
    }
  }

  initEventListeners() {
    // Voice speech toggle
    if (this.voiceToggleBtn) {
      this.voiceToggleBtn.addEventListener('click', () => {
        const isEnabled = window.soundEffects.toggleVoice();
        if (this.voiceIcon) {
          this.voiceIcon.textContent = isEnabled ? '🔊' : '🔇';
        }
        this.showToast(isEnabled ? '🔊 Озвучка включена' : '🔇 Озвучка выключена (только сигналы)');
      });
    }

    // Voice settings modal events
    const updateEngineUi = (engine) => {
      if (engine === 'alice') {
        if (this.aliceConfigBlock) this.aliceConfigBlock.style.display = 'block';
        if (this.deviceVoiceBlock) this.deviceVoiceBlock.style.display = 'none';
        if (this.engineAliceBtn) {
          this.engineAliceBtn.style.background = '#9333ea';
          this.engineAliceBtn.style.color = 'white';
          this.engineAliceBtn.style.borderColor = '#9333ea';
        }
        if (this.engineDeviceBtn) {
          this.engineDeviceBtn.style.background = 'var(--bg-card)';
          this.engineDeviceBtn.style.color = 'var(--text-primary)';
          this.engineDeviceBtn.style.borderColor = 'var(--border-card)';
        }
      } else {
        if (this.aliceConfigBlock) this.aliceConfigBlock.style.display = 'none';
        if (this.deviceVoiceBlock) this.deviceVoiceBlock.style.display = 'block';
        if (this.engineDeviceBtn) {
          this.engineDeviceBtn.style.background = 'var(--primary)';
          this.engineDeviceBtn.style.color = 'white';
          this.engineDeviceBtn.style.borderColor = 'var(--primary)';
        }
        if (this.engineAliceBtn) {
          this.engineAliceBtn.style.background = 'var(--bg-card)';
          this.engineAliceBtn.style.color = 'var(--text-primary)';
          this.engineAliceBtn.style.borderColor = 'var(--border-card)';
        }
      }
    };

    if (this.openVoiceSettingsBtn) {
      this.openVoiceSettingsBtn.addEventListener('click', () => {
        this.populateVoiceSelect();
        if (this.voiceEnableCheckbox) {
          this.voiceEnableCheckbox.checked = window.soundEffects.voiceEnabled;
        }
        if (this.soundFxCheckbox) {
          this.soundFxCheckbox.checked = window.soundEffects.enabled;
        }
        if (this.hapticsCheckbox) {
          this.hapticsCheckbox.checked = window.soundEffects.hapticsEnabled;
        }
        if (this.currencySelect) {
          this.currencySelect.value = this.currency;
        }
        if (this.wakeLockCheckbox) {
          this.wakeLockCheckbox.checked = this.wakeLockEnabled;
        }
        if (this.yandexEmotionSelect) {
          this.yandexEmotionSelect.value = window.soundEffects.yandexEmotion || 'good';
        }
        updateEngineUi(window.soundEffects.voiceEngine);
        this.voiceSettingsModal.classList.add('active');
      });
    }

    if (this.engineAliceBtn) {
      this.engineAliceBtn.addEventListener('click', () => {
        window.soundEffects.setEngine('alice');
        updateEngineUi('alice');
      });
    }

    if (this.engineDeviceBtn) {
      this.engineDeviceBtn.addEventListener('click', () => {
        window.soundEffects.setEngine('device');
        updateEngineUi('device');
      });
    }

    if (this.closeVoiceSettingsBtn) {
      this.closeVoiceSettingsBtn.addEventListener('click', () => {
        this.voiceSettingsModal.classList.remove('active');
      });
    }

    if (this.voiceSettingsModal) {
      this.voiceSettingsModal.addEventListener('click', (e) => {
        if (e.target === this.voiceSettingsModal) {
          this.voiceSettingsModal.classList.remove('active');
        }
      });
    }

    if (this.voiceEnableCheckbox) {
      this.voiceEnableCheckbox.addEventListener('change', (e) => {
        window.soundEffects.voiceEnabled = e.target.checked;
        localStorage.setItem('shopping_voice_enabled', e.target.checked);
        if (this.voiceIcon) {
          this.voiceIcon.textContent = e.target.checked ? '🔊' : '🔇';
        }
      });
    }

    if (this.soundFxCheckbox) {
      this.soundFxCheckbox.addEventListener('change', (e) => {
        window.soundEffects.enabled = e.target.checked;
        localStorage.setItem('shopping_sound_enabled', e.target.checked);
      });
    }

    if (this.hapticsCheckbox) {
      this.hapticsCheckbox.addEventListener('change', (e) => {
        window.soundEffects.hapticsEnabled = e.target.checked;
        localStorage.setItem('shopping_haptics_enabled', e.target.checked);
        if (e.target.checked) {
          window.soundEffects.vibrate(35);
        }
      });
    }

    if (this.wakeLockBtn) {
      this.wakeLockBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleWakeLock(true);
      });
    }

    if (this.wakeLockCheckbox) {
      this.wakeLockCheckbox.addEventListener('change', (e) => {
        if (e.target.checked !== this.wakeLockEnabled) {
          this.toggleWakeLock(true);
        }
      });
    }

    if (this.currencySelect) {
      this.currencySelect.addEventListener('change', (e) => {
        this.currency = e.target.value;
        localStorage.setItem('shopping_currency', this.currency);
        this.render();
        this.showToast(`Валюта: ${this.getCurrencySymbol()}`);
      });
    }

    const saveYandexEmotion = () => {
      window.soundEffects.setYandexEmotion(this.yandexEmotionSelect ? this.yandexEmotionSelect.value : 'good');
    };

    if (this.yandexEmotionSelect) {
      this.yandexEmotionSelect.addEventListener('change', saveYandexEmotion);
    }

    if (this.testAliceBtn) {
      this.testAliceBtn.addEventListener('click', () => {
        saveYandexEmotion();
        if (!window.soundEffects.aliceAvailable) {
          this.showToast('⚠️ Голос Алисы не настроен на сервере (YANDEX_API_KEY)');
          return;
        }
        this.showToast('🟣 Проверяю голос Алисы...');
        window.soundEffects.speakAlice('Привет! Я Алиса, помогу не забыть покупки в магазине.');
      });
    }

    if (this.voiceSelect) {
      this.voiceSelect.addEventListener('change', (e) => {
        window.soundEffects.setVoice(e.target.value);
      });
    }

    if (this.testVoiceBtn) {
      this.testVoiceBtn.addEventListener('click', () => {
        window.soundEffects.speakSystem('Привет! Этим голосом я буду помогать вам в магазине.');
      });
    }

    // Theme toggle
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Check status button
    if (this.checkStatusBtn) {
      this.checkStatusBtn.addEventListener('click', () => {
        this.checkStatus(true);
      });
    }

    // Budget limit setup
    if (this.budgetLimitTrigger) {
      this.budgetLimitTrigger.addEventListener('click', () => {
        this.setBudgetLimit();
      });
    }

    // Add via text
    this.addBtn.addEventListener('click', () => this.handleAddFromInput());
    this.textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleAddFromInput();
      }
    });

    // Voice triggers
    if (this.micBtn) this.micBtn.addEventListener('click', () => this.startVoiceInput());
    if (this.fabMicBtn) this.fabMicBtn.addEventListener('click', () => this.startVoiceInput());
    if (this.closeVoiceBtn) this.closeVoiceBtn.addEventListener('click', () => this.stopVoiceInput());

    // Filters
    this.filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.filterBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentFilter = e.currentTarget.dataset.filter;
        this.render();
      });
    });

    // Clear options modal
    if (this.clearCompletedBtn) {
      this.clearCompletedBtn.addEventListener('click', () => {
        if (this.items.length === 0) {
          this.showToast('Список покупок уже пуст');
          return;
        }

        const completedCount = this.items.filter(i => i.completed).length;
        const totalCount = this.items.length;

        if (this.clearOnlyCompletedBadge) this.clearOnlyCompletedBadge.textContent = completedCount;
        if (this.clearEverythingBadge) this.clearEverythingBadge.textContent = totalCount;

        if (this.clearOnlyCompletedBtn) {
          if (completedCount === 0) {
            this.clearOnlyCompletedBtn.style.opacity = '0.5';
            if (this.clearOnlyCompletedSubtext) this.clearOnlyCompletedSubtext.textContent = 'Нет купленных товаров';
          } else {
            this.clearOnlyCompletedBtn.style.opacity = '1';
            if (this.clearOnlyCompletedSubtext) this.clearOnlyCompletedSubtext.textContent = `Удалить вычеркнутые (${completedCount})`;
          }
        }

        if (this.clearModal) {
          this.clearModal.classList.add('active');
        }
      });
    }

    if (this.closeClearModalBtn) {
      this.closeClearModalBtn.addEventListener('click', () => {
        if (this.clearModal) this.clearModal.classList.remove('active');
      });
    }

    if (this.cancelClearBtn) {
      this.cancelClearBtn.addEventListener('click', () => {
        if (this.clearModal) this.clearModal.classList.remove('active');
      });
    }

    if (this.clearModal) {
      this.clearModal.addEventListener('click', (e) => {
        if (e.target === this.clearModal) {
          this.clearModal.classList.remove('active');
        }
      });
    }

    if (this.clearOnlyCompletedBtn) {
      this.clearOnlyCompletedBtn.addEventListener('click', () => {
        const completedCount = this.items.filter(i => i.completed).length;
        if (completedCount === 0) {
          this.showToast('Нет купленных товаров для удаления');
          return;
        }
        this.items = this.items.filter(i => !i.completed);
        this.saveItems();
        this.render();
        window.soundEffects.playDelete();
        this.showToast(`Удалено купленных товаров: ${completedCount}`);
        if (this.clearModal) this.clearModal.classList.remove('active');
      });
    }

    if (this.clearEverythingBtn) {
      this.clearEverythingBtn.addEventListener('click', () => {
        const count = this.items.length;
        this.items = [];
        this.saveItems();
        this.render();
        window.soundEffects.playDelete();
        this.showToast(`🗑️ Список полностью очищен (${count} товаров)`);
        if (this.clearModal) this.clearModal.classList.remove('active');
      });
    }

    // Share list
    this.shareBtn.addEventListener('click', () => this.shareList());

    // QR Modal
    if (this.openQrBtn) {
      this.openQrBtn.addEventListener('click', () => {
        this.fetchPhoneConnectionInfo();
        this.qrModal.classList.add('active');
      });
    }
    if (this.closeQrBtn) {
      this.closeQrBtn.addEventListener('click', () => {
        this.qrModal.classList.remove('active');
      });
    }
    if (this.qrModal) {
      this.qrModal.addEventListener('click', (e) => {
        if (e.target === this.qrModal) {
          this.qrModal.classList.remove('active');
        }
      });
    }

    // Toggle Grouping
    const groupToggle = document.getElementById('groupToggle');
    if (groupToggle) {
      groupToggle.addEventListener('change', (e) => {
        this.groupByCategory = e.target.checked;
        this.render();
      });
    }

    // Help Modal
    if (this.openHelpBtn) {
      this.openHelpBtn.addEventListener('click', () => {
        if (this.helpModal) this.helpModal.classList.add('active');
        if (window.soundEffects) window.soundEffects.vibrate(25);
      });
    }
    if (this.closeHelpBtn) {
      this.closeHelpBtn.addEventListener('click', () => {
        if (this.helpModal) this.helpModal.classList.remove('active');
      });
    }
    if (this.closeHelpBottomBtn) {
      this.closeHelpBottomBtn.addEventListener('click', () => {
        if (this.helpModal) this.helpModal.classList.remove('active');
      });
    }
    if (this.helpModal) {
      this.helpModal.addEventListener('click', (e) => {
        if (e.target === this.helpModal) {
          this.helpModal.classList.remove('active');
        }
      });
    }

    // Empty state quick action cards
    if (this.emptyMicTrigger) {
      this.emptyMicTrigger.addEventListener('click', () => this.startVoiceInput());
    }
    if (this.emptyChefTrigger) {
      this.emptyChefTrigger.addEventListener('click', () => {
        if (this.chefManager) this.chefManager.open();
      });
    }
    if (this.emptyCameraTrigger) {
      this.emptyCameraTrigger.addEventListener('click', () => {
        const cam = document.getElementById('cameraInput');
        if (cam) cam.click();
      });
    }

    // Voice Modal clickable hint tags
    document.querySelectorAll('.voice-hints .hint-tag[data-hint]').forEach(tag => {
      tag.addEventListener('click', (e) => {
        const hint = e.currentTarget.getAttribute('data-hint');
        if (hint) {
          this.stopVoiceInput();
          setTimeout(() => {
            this.handleVoiceCommand(hint);
          }, 200);
        }
      });
    });
  }

  initVoice() {
    window.VoiceManager.onStart = () => {
      this.voiceModal.classList.add('active');
      this.voiceStatus.textContent = 'Слушаю вас... Говорите!';
      this.voiceTranscript.textContent = '«Хочу добавить колбасу» или «Купил молоко»';
      this.voiceWaves.classList.add('animate');
    };

    window.VoiceManager.onInterim = (text) => {
      this.voiceStatus.textContent = 'Распознаю речь...';
      this.voiceTranscript.textContent = `«${text}»`;
    };

    window.VoiceManager.onFinal = (text) => {
      this.voiceStatus.textContent = '✅ Готово!';
      this.voiceTranscript.textContent = `«${text}»`;
      this.handleVoiceCommand(text);

      setTimeout(() => {
        this.stopVoiceInput();
      }, 800);
    };

    window.VoiceManager.onError = (error) => {
      console.warn('Voice error', error);
      if (error === 'not_supported') {
        this.voiceStatus.textContent = 'Микрофон не поддерживается';
        this.showToast('Используйте Chrome на Android или Safari на iPhone');
      } else if (error === 'not-allowed') {
        this.voiceStatus.textContent = 'Микрофон заблокирован';
        this.showToast('Разрешите доступ к микрофону (требуется HTTPS)');
      } else if (error === 'no-speech') {
        this.voiceStatus.textContent = 'Речь не услышана';
      }
      setTimeout(() => {
        this.stopVoiceInput();
      }, 1200);
    };

    window.VoiceManager.onEnd = () => {
      this.voiceWaves.classList.remove('animate');
      setTimeout(() => {
        this.voiceModal.classList.remove('active');
      }, 300);
    };
  }

  startVoiceInput() {
    window.soundEffects.init();
    window.VoiceManager.start();
  }

  stopVoiceInput() {
    window.VoiceManager.stop();
    this.voiceWaves.classList.remove('animate');
    this.voiceModal.classList.remove('active');
  }

  handleVoiceCommand(text) {
    if (!text || !text.trim()) return;

    const intent = window.GroceryParser.detectVoiceIntent(text, this.items);

    if (intent.type === 'check_status') {
      this.checkStatus(true);
      return;
    }

    if (intent.type === 'chef_recipe') {
      if (this.chefManager) {
        this.chefManager.open(intent.dish);
      }
      return;
    }

    if (intent.type === 'chef_suggest') {
      if (this.chefManager) {
        this.chefManager.open();
        this.chefManager.suggestFromCurrentCart();
      }
      return;
    }

    if (intent.type === 'complete') {
      if (intent.items && intent.items.length > 0) {
        intent.items.forEach(item => {
          item.completed = true;
          if (intent.price) {
            item.price = intent.price;
            this.savePriceHistory(item.title, intent.price);
          }
        });
        this.saveItems();
        this.render();
        window.soundEffects.playItemChecked();

        const allDone = this.items.length > 0 && this.items.every(i => i.completed);
        if (allDone) {
          this.triggerAllCompletedCelebration(intent.items.map(i => i.title).join(', '));
        } else {
          if (intent.items.length === 1) {
            const title = intent.items[0].title;
            const priceText = intent.price ? ` (${this.formatPrice(intent.price)})` : '';
            this.showToast(`✔️ Вычеркнуто: ${title}${priceText}`);
            const voiceText = intent.price 
              ? `Вычеркнул ${title} за ${this.formatPriceForVoice(intent.price)}`
              : `Вычеркнул ${title}`;
            window.soundEffects.speak(voiceText);
          } else {
            this.showToast(`✔️ Вычеркнуто товаров: ${intent.items.length}`);
            const titles = intent.items.map(i => i.title).join(', ');
            window.soundEffects.speak(`Вычеркнул: ${titles}`);
          }
        }
      } else {
        const query = intent.targetPhrase || (intent.isGeneric ? 'товар' : 'указанный товар');
        this.showToast(`Товар «${query}» не найден в списке`);
        window.soundEffects.speak(`Не нашёл в списке: ${query}`);
      }
    } else if (intent.type === 'uncomplete') {
      if (intent.items && intent.items.length > 0) {
        intent.items.forEach(item => {
          item.completed = false;
        });
        this.saveItems();
        this.render();
        window.soundEffects.playItemUnchecked();

        const title = intent.items[0].title;
        this.showToast(`↩️ Возвращено в список: ${title}`);
        window.soundEffects.speak(`Вернул в список ${title}`);
      } else {
        this.showToast(`Товар «${intent.targetPhrase}» не найден`);
      }
    } else {
      // Add items
      const parsedItems = intent.items;
      if (parsedItems && parsedItems.length > 0) {
        // Auto-check price history if item doesn't have an explicit price
        parsedItems.forEach(item => {
          if (!item.price) {
            const histPrice = this.getPriceHistory(item.title);
            if (histPrice) {
              item.price = histPrice;
            }
          } else {
            this.savePriceHistory(item.title, item.price);
          }
        });

        this.items = [...parsedItems, ...this.items];
        this.saveItems();
        this.render();
        window.soundEffects.playItemAdded();

        const count = parsedItems.length;
        const countWord = this.declension(count, ['товар', 'товара', 'товаров']);
        const countText = count === 1 
          ? `Добавлен товар: ${parsedItems[0].title}${parsedItems[0].price ? ` (${this.formatPrice(parsedItems[0].price)})` : ''}`
          : `Добавлено: ${parsedItems.map(p => p.title).join(', ')}`;
        this.showToast(`✨ ${countText}`);

        if (count === 1) {
          window.soundEffects.speak(`Добавил ${parsedItems[0].title}`);
        } else {
          window.soundEffects.speak(`Добавил ${count} ${countWord}`);
        }
      } else {
        this.showToast('Не удалось распознать товар, попробуйте еще раз');
      }
    }
  }

  handleAddFromInput() {
    const text = this.textInput.value.trim();
    if (!text) return;

    window.soundEffects.init();
    this.handleVoiceCommand(text);
    this.textInput.value = '';
  }

  triggerAllCompletedCelebration(lastItemTitle = '') {
    window.soundEffects.playAllDoneFanfare();

    const inCartTotal = this.items
      .filter(i => i.price)
      .reduce((sum, i) => sum + (Number(i.price) || 0), 0);

    if (this.celebrationBanner) {
      this.celebrationBanner.style.display = 'block';
      this.celebrationBanner.classList.add('pulse-glow');
      if (inCartTotal > 0) {
        this.celebrationBanner.textContent = `🎉 Все покупки сделаны! Итого: ${this.formatPrice(inCartTotal)}`;
      } else {
        this.celebrationBanner.textContent = '🎉 Все покупки сделаны! Вы ничего не забыли!';
      }
    }

    const toastMsg = inCartTotal > 0
      ? `🎉 Все покупки сделаны! Итого потрачено: ${this.formatPrice(inCartTotal)}`
      : '🎉 Все покупки сделаны! Вы ничего не забыли!';
    this.showToast(toastMsg);

    const prefix = lastItemTitle ? `Вычеркнул ${lastItemTitle}. ` : '';
    const totalVoice = inCartTotal > 0 ? ` Итоговая сумма покупок: ${this.formatPriceForVoice(inCartTotal)}.` : '';
    const voiceMsg = `${prefix}Поздравляю! Вы купили всё по списку!${totalVoice}`;
    window.soundEffects.speak(voiceMsg, 400);
  }

  checkStatus(isVoice = true) {
    window.soundEffects.init();
    const total = this.items.length;
    if (total === 0) {
      const msg = 'Список покупок пуст. Добавьте нужные товары!';
      this.showToast(msg);
      if (isVoice) window.soundEffects.speak(msg);
      return;
    }

    const uncompleted = this.items.filter(i => !i.completed);
    if (uncompleted.length === 0) {
      this.triggerAllCompletedCelebration();
    } else {
      const count = uncompleted.length;
      let namesStr = '';
      if (count <= 3) {
        namesStr = uncompleted.map(i => i.title).join(', ');
      } else {
        const first = uncompleted.slice(0, 3).map(i => i.title).join(', ');
        const rest = count - 3;
        namesStr = `${first} и ещё ${rest} ${this.declension(rest, ['товар', 'товара', 'товаров'])}`;
      }

      const toastMsg = `⚠️ Не куплено (${count}): ${namesStr}`;
      const voiceMsg = `Вы не купили: ${namesStr}. Осталось ${count} ${this.declension(count, ['товар', 'товара', 'товаров'])}.`;

      this.showToast(toastMsg);
      if (isVoice) window.soundEffects.speak(voiceMsg);
    }
  }

  declension(number, words) {
    const cases = [2, 0, 1, 1, 1, 2];
    return words[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
  }

  toggleItem(id) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.completed = !item.completed;
      if (item.completed) {
        window.soundEffects.playItemChecked();
        this.saveItems();
        this.render();

        const allDone = this.items.length > 0 && this.items.every(i => i.completed);
        if (allDone) {
          this.triggerAllCompletedCelebration(item.title);
        }
      } else {
        window.soundEffects.playItemUnchecked();
        this.saveItems();
        this.render();
      }
    }
  }

  deleteItem(id) {
    window.soundEffects.playDelete();
    this.items = this.items.filter(i => i.id !== id);
    this.saveItems();
    this.render();
    this.showToast('Товар удален');
  }

  updateQuantity(id, delta) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    // Try extracting numeric amount from item.quantity (e.g., "2 кг", "1 шт")
    const match = item.quantity.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      let num = parseFloat(match[1]);
      const unit = match[2];
      num = Math.max(1, num + delta);
      item.quantity = `${num} ${unit}`.trim();
    } else if (!item.quantity) {
      if (delta > 0) {
        item.quantity = '2 шт.';
      }
    } else {
      item.quantity = `${item.quantity} (+${delta > 0 ? 1 : -1})`;
    }

    this.saveItems();
    this.render();
  }

  editItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    const newTitle = prompt('Название товара:', item.title);
    if (newTitle === null) return;
    if (newTitle.trim()) {
      item.title = newTitle.trim();
    }

    const newQty = prompt('Количество / вес (например: 2 кг, 1 уп.):', item.quantity || '');
    if (newQty !== null) {
      item.quantity = newQty.trim();
    }

    const currentPrice = item.price || '';
    const newPrice = prompt('Цена товара в рублях (опционально, оставьте пустым для удаления):', currentPrice);
    if (newPrice !== null) {
      const trimmedPrice = newPrice.trim();
      if (!trimmedPrice) {
        item.price = null;
      } else {
        const num = parseFloat(trimmedPrice.replace(',', '.'));
        if (!isNaN(num) && num > 0) {
          item.price = Math.round(num);
          this.savePriceHistory(item.title, item.price);
        }
      }
    }

    // Recalculate category
    const detected = window.GroceryParser.detectCategory(item.title);
    item.category = detected.id;

    this.saveItems();
    this.render();
  }

  promptItemPrice(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    const current = item.price || '';
    const input = prompt(`Цена для «${item.title}» в ${this.getCurrencySymbol()}:\n(Например: 1.89 или 2.50, пусто для удаления)`, current);
    if (input === null) return;

    const trimmed = input.trim();
    if (!trimmed) {
      item.price = null;
      this.showToast(`Цена для «${item.title}» удалена`);
    } else {
      const num = parseFloat(trimmed.replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        item.price = num % 1 === 0 ? Math.round(num) : parseFloat(num.toFixed(2));
        this.savePriceHistory(item.title, item.price);
        this.showToast(`💰 «${item.title}»: ${this.formatPrice(item.price)}`);
        window.soundEffects.vibrate(25);
      }
    }

    this.saveItems();
    this.render();
  }

  setBudgetLimit() {
    const current = this.budgetLimit || '';
    const input = prompt(`🎯 Укажите лимит бюджета в ${this.getCurrencySymbol()}:\n(Например: 50 или 75, пусто для сброса)`, current);
    if (input === null) return;

    const trimmed = input.trim();
    if (!trimmed) {
      this.budgetLimit = null;
      localStorage.removeItem('shopping_budget_limit');
      this.showToast('🎯 Лимит бюджета сброшен');
    } else {
      const num = parseFloat(trimmed.replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        this.budgetLimit = num % 1 === 0 ? Math.round(num) : parseFloat(num.toFixed(2));
        localStorage.setItem('shopping_budget_limit', String(this.budgetLimit));
        this.showToast(`🎯 Бюджет установлен: ${this.formatPrice(this.budgetLimit)}`);
        window.soundEffects.vibrate(35);
      }
    }
    this.render();
  }

  savePriceHistory(title, price) {
    if (!title || !price) return;
    try {
      const key = title.trim().toLowerCase();
      const history = JSON.parse(localStorage.getItem('shopping_price_history') || '{}');
      history[key] = price;
      localStorage.setItem('shopping_price_history', JSON.stringify(history));
    } catch (e) {
      // ignore
    }
  }

  getPriceHistory(title) {
    if (!title) return null;
    try {
      const key = title.trim().toLowerCase();
      const history = JSON.parse(localStorage.getItem('shopping_price_history') || '{}');
      return history[key] || null;
    } catch (e) {
      return null;
    }
  }

  updateBudgetSummary() {
    const inCartTotal = this.items
      .filter(i => i.completed && i.price)
      .reduce((sum, i) => sum + (Number(i.price) || 0), 0);

    const planTotal = this.items
      .filter(i => i.price)
      .reduce((sum, i) => sum + (Number(i.price) || 0), 0);

    if (this.budgetCartTotal) {
      this.budgetCartTotal.textContent = this.formatPrice(inCartTotal) || `0,00 ${this.getCurrencySymbol()}`;
    }

    if (this.budgetPlanTotal) {
      this.budgetPlanTotal.textContent = this.formatPrice(planTotal) || `0,00 ${this.getCurrencySymbol()}`;
    }

    if (this.budgetLimitValue) {
      if (this.budgetLimit && this.budgetLimit > 0) {
        const isOver = inCartTotal > this.budgetLimit;
        if (isOver) {
          const overDiff = inCartTotal - this.budgetLimit;
          this.budgetLimitValue.textContent = `⚠️ +${this.formatPrice(overDiff)}`;
          this.budgetLimitValue.className = 'budget-value limit over-budget';
          this.budgetLimitValue.title = `Бюджет ${this.formatPrice(this.budgetLimit)} превышен на ${this.formatPrice(overDiff)}!`;
        } else {
          const remaining = this.budgetLimit - inCartTotal;
          this.budgetLimitValue.textContent = this.formatPrice(this.budgetLimit);
          this.budgetLimitValue.className = 'budget-value limit';
          this.budgetLimitValue.title = `Осталось в бюджете: ${this.formatPrice(remaining)}`;
        }
      } else {
        this.budgetLimitValue.textContent = 'Указать';
        this.budgetLimitValue.className = 'budget-value limit';
        this.budgetLimitValue.title = 'Нажмите, чтобы задать лимит расходов';
      }
    }
  }

  shareList() {
    if (this.items.length === 0) {
      this.showToast('Список пуст — нечем делиться');
      return;
    }

    const uncompleted = this.items.filter(i => !i.completed);
    const completed = this.items.filter(i => i.completed);

    let text = '🛒 Список покупок:\n\n';

    if (uncompleted.length > 0) {
      text += 'Нужно купить:\n';
      uncompleted.forEach(item => {
        const pStr = item.price ? ` — ${this.formatPrice(item.price)}` : '';
        text += `▫️ ${item.title}${item.quantity ? ` (${item.quantity})` : ''}${pStr}\n`;
      });
    }

    if (completed.length > 0) {
      text += '\nУже куплено:\n';
      completed.forEach(item => {
        const pStr = item.price ? ` — ${this.formatPrice(item.price)}` : '';
        text += `✔️ ~${item.title}~${pStr}\n`;
      });
    }

    const inCartTotal = this.items.filter(i => i.completed && i.price).reduce((s, i) => s + (Number(i.price) || 0), 0);
    const planTotal = this.items.filter(i => i.price).reduce((s, i) => s + (Number(i.price) || 0), 0);
    if (inCartTotal > 0 || planTotal > 0) {
      text += `\n💰 В корзине: ${this.formatPrice(inCartTotal)} | Всего: ${this.formatPrice(planTotal)}\n`;
    }

    text += '\n📱 Создано в приложении «Голосовой Список Покупок»';

    if (navigator.share) {
      navigator.share({
        title: 'Список покупок',
        text: text
      }).catch(err => {
        console.log('Share canceled or error:', err);
      });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('📋 Список скопирован в буфер обмена!');
      });
    } else {
      alert(text);
    }
  }

  fetchPhoneConnectionInfo() {
    const networkIpText = document.getElementById('networkIpText');
    const qrImage = document.getElementById('qrImage');
    const pageUrl = window.location.href.split('#')[0].split('?')[0];

    // If hosted online (GitHub Pages, Vercel, or any HTTPS domain)
    if (window.location.protocol === 'https:' || (!window.location.hostname.includes('localhost') && !window.location.hostname.startsWith('192.168.'))) {
      if (networkIpText) {
        networkIpText.innerHTML = `Ссылка на приложение:<br><b style="color: var(--primary); font-size: 0.95rem; word-break: break-all;">${this.escapeHtml(pageUrl)}</b>`;
      }
      if (qrImage) {
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pageUrl)}`;
      }
      return;
    }

    // Otherwise local development mode: fetch local Wi-Fi IP
    fetch('/api/info')
      .then(res => res.json())
      .then(data => {
        if (data && data.phoneUrl) {
          if (networkIpText) {
            networkIpText.innerHTML = `Адрес в домашней сети Wi-Fi:<br><b style="color: var(--primary); font-size: 1rem;">${this.escapeHtml(data.phoneUrl)}</b>`;
          }
          if (qrImage) {
            qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.phoneUrl)}`;
          }
        }
      })
      .catch(() => {
        if (networkIpText) {
          networkIpText.innerHTML = `Ссылка на приложение:<br><b style="color: var(--primary); font-size: 0.95rem; word-break: break-all;">${this.escapeHtml(pageUrl)}</b>`;
        }
        if (qrImage) {
          qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pageUrl)}`;
        }
      });
  }

  showToast(message) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2500);
  }

  initPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.log('ServiceWorker registration failed: ', err);
      });
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const dismissedAt = localStorage.getItem('pwa_banner_dismissed_at');
    const isDismissedRecent = dismissedAt && (Date.now() - parseInt(dismissedAt, 10)) < 7 * 24 * 3600 * 1000;

    // Show banner on mobile/desktop browsers if not in standalone app mode and not recently closed
    if (!isStandalone && !isDismissedRecent && this.pwaInstallBanner) {
      this.pwaInstallBanner.style.display = 'flex';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (!isStandalone && !isDismissedRecent && this.pwaInstallBanner) {
        this.pwaInstallBanner.style.display = 'flex';
      }
      const nativeSec = document.getElementById('nativeInstallPromptSection');
      if (nativeSec) nativeSec.style.display = 'block';
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      if (this.pwaInstallBanner) this.pwaInstallBanner.style.display = 'none';
      this.showToast('🎉 Иконка успешно добавлена на экран!');
    });

    const triggerInstall = async () => {
      if (this.deferredInstallPrompt) {
        try {
          this.deferredInstallPrompt.prompt();
          const { outcome } = await this.deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            if (this.pwaInstallBanner) this.pwaInstallBanner.style.display = 'none';
            this.showToast('✅ Иконка добавлена на ваш экран!');
          }
          this.deferredInstallPrompt = null;
          return;
        } catch (e) {
          console.warn('Install prompt error:', e);
        }
      }
      // If native prompt unavailable (e.g. iOS Safari, Firefox, or already prompted), show visual instructions
      this.openInstallModal();
    };

    if (this.installAppBtn) {
      this.installAppBtn.addEventListener('click', triggerInstall);
    }

    if (this.openInstallBtn) {
      this.openInstallBtn.addEventListener('click', triggerInstall);
    }

    if (this.nativePromptBtn) {
      this.nativePromptBtn.addEventListener('click', triggerInstall);
    }

    if (this.closeBannerBtn) {
      this.closeBannerBtn.addEventListener('click', () => {
        if (this.pwaInstallBanner) this.pwaInstallBanner.style.display = 'none';
        localStorage.setItem('pwa_banner_dismissed_at', Date.now().toString());
      });
    }

    if (this.closeInstallModalBtn) {
      this.closeInstallModalBtn.addEventListener('click', () => this.closeInstallModal());
    }

    if (this.closeInstallModalBottomBtn) {
      this.closeInstallModalBottomBtn.addEventListener('click', () => this.closeInstallModal());
    }

    if (this.installModal) {
      this.installModal.addEventListener('click', (e) => {
        if (e.target === this.installModal) this.closeInstallModal();
      });
    }
  }

  openInstallModal() {
    if (!this.installModal) return;
    const ua = (window.navigator.userAgent || '').toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isInApp = /telegram|whatsapp|viber|fbav|instagram|vkshare|micromessenger|; wv|version\/4\.0/.test(ua);

    const inAppCard = document.getElementById('inAppBrowserCard');
    const iosGuide = document.getElementById('iosGuideCard');
    const androidGuide = document.getElementById('androidGuideCard');
    const nativeSec = document.getElementById('nativeInstallPromptSection');

    if (inAppCard) {
      inAppCard.style.display = isInApp ? 'block' : 'none';
    }

    if (this.deferredInstallPrompt && nativeSec && !isInApp) {
      nativeSec.style.display = 'block';
    }

    if (iosGuide && androidGuide) {
      if (isIos) {
        iosGuide.style.border = '2px solid var(--primary)';
        iosGuide.style.background = 'rgba(99, 102, 241, 0.08)';
        androidGuide.style.opacity = '0.55';
      } else {
        androidGuide.style.border = '2px solid var(--primary)';
        androidGuide.style.background = 'rgba(99, 102, 241, 0.08)';
        iosGuide.style.opacity = '0.55';
      }
    }

    this.installModal.classList.add('active');
  }

  closeInstallModal() {
    if (this.installModal) {
      this.installModal.classList.remove('active');
    }
  }

  render() {
    // 1. Stats and Progress
    const total = this.items.length;
    const completedCount = this.items.filter(i => i.completed).length;
    const activeCount = total - completedCount;

    this.totalCountEl.textContent = total;
    const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    this.progressFillEl.style.width = `${percent}%`;
    this.progressTextEl.textContent = `${completedCount} из ${total} куплено (${percent}%)`;

    // 2. Budget and Price Summary
    this.updateBudgetSummary();

    if (this.checkStatusBtnText) {
      if (total > 0 && completedCount === total) {
        this.checkStatusBtnText.textContent = 'Всё куплено!';
        this.checkStatusBtn.classList.add('all-done');
        if (this.celebrationBanner) this.celebrationBanner.style.display = 'block';
      } else {
        this.checkStatusBtnText.textContent = activeCount > 0 ? `Что осталось? (${activeCount})` : 'Что осталось?';
        this.checkStatusBtn.classList.remove('all-done');
        if (this.celebrationBanner) this.celebrationBanner.style.display = 'none';
      }
    }

    // 2. Filter items
    let filtered = this.items;
    if (this.currentFilter === 'active') {
      filtered = this.items.filter(i => !i.completed);
    } else if (this.currentFilter === 'completed') {
      filtered = this.items.filter(i => i.completed);
    }

    if (filtered.length === 0) {
      this.itemsContainer.innerHTML = '';
      this.emptyState.style.display = 'flex';
      return;
    }

    this.emptyState.style.display = 'none';
    this.itemsContainer.innerHTML = '';

    if (this.groupByCategory) {
      this.renderGrouped(filtered);
    } else {
      this.renderFlat(filtered);
    }
  }

  renderGrouped(items) {
    // Group by category
    const groups = {};
    for (const item of items) {
      const catKey = item.category || 'other';
      if (!groups[catKey]) {
        groups[catKey] = [];
      }
      groups[catKey].push(item);
    }

    for (const [catKey, catItems] of Object.entries(groups)) {
      const category = window.CATEGORIES[catKey] || window.CATEGORIES.other;

      const groupSection = document.createElement('div');
      groupSection.className = 'category-group';

      const header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML = `
        <span class="category-icon">${category.icon}</span>
        <span class="category-name">${category.name}</span>
        <span class="category-badge">${catItems.length}</span>
      `;
      groupSection.appendChild(header);

      const itemsList = document.createElement('div');
      itemsList.className = 'category-items-list';

      catItems.forEach(item => {
        itemsList.appendChild(this.createItemElement(item));
      });

      groupSection.appendChild(itemsList);
      this.itemsContainer.appendChild(groupSection);
    }
  }

  renderFlat(items) {
    const list = document.createElement('div');
    list.className = 'flat-items-list';
    items.forEach(item => {
      list.appendChild(this.createItemElement(item));
    });
    this.itemsContainer.appendChild(list);
  }

  createItemElement(item) {
    const cat = window.CATEGORIES[item.category] || window.CATEGORIES.other;

    const el = document.createElement('div');
    el.className = `shopping-item ${item.completed ? 'completed' : ''}`;
    el.dataset.id = item.id;

    el.innerHTML = `
      <button class="checkbox-btn" aria-label="Отметить товар" data-action="toggle">
        <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>

      <div class="item-content" data-action="toggle">
        <div class="item-title-row">
          <span class="item-title">${this.escapeHtml(item.title)}</span>
          ${item.quantity ? `<span class="item-quantity-badge">${this.escapeHtml(item.quantity)}</span>` : ''}
          ${item.price ? `<span class="item-price-badge" data-action="price" title="Нажмите, чтобы изменить цену">${this.formatPrice(item.price)}</span>` : `<button class="item-price-empty" data-action="price" title="Указать цену">+ ${this.getCurrencySymbol()}</button>`}
        </div>
        <div class="item-category-badge" style="background-color: ${cat.color}15; color: ${cat.color};">
          ${cat.icon} ${cat.name}
        </div>
      </div>

      <div class="item-actions">
        <button class="btn-item-action" data-action="edit" title="Редактировать товар">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="btn-item-action" data-action="delete" title="Удалить товар">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Click anywhere on card or checkbox toggles it; buttons edit/delete
    el.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        e.stopPropagation();
        this.deleteItem(item.id);
        return;
      }
      const editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn) {
        e.stopPropagation();
        this.editItem(item.id);
        return;
      }
      const priceBtn = e.target.closest('[data-action="price"]');
      if (priceBtn) {
        e.stopPropagation();
        this.promptItemPrice(item.id);
        return;
      }
      this.toggleItem(item.id);
    });

    return el;
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

window.ShoppingApp = ShoppingApp;

// Launch on DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new ShoppingApp();
  });
}
