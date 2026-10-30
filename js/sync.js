// Family Real-Time Sync Manager
// Enables multiple family members to share and edit shopping lists in real-time
// without passwords, registration or complex setup.

class FamilySyncManager {
  constructor(app) {
    this.app = app;
    this.roomCode = localStorage.getItem('shopping_family_room') || null;
    this.deviceId = this.getOrCreateDeviceId();
    this.deviceName = localStorage.getItem('shopping_device_name') || this.getDefaultDeviceName();
    this.eventSource = null;
    this.reconnectTimeout = null;
    this.lastReceivedTimestamp = 0;
    this.isSyncingOutbound = false;
    this.isConnected = false;

    this.initElements();
    this.initEventListeners();
    this.checkUrlForRoom();

    if (this.roomCode) {
      this.connect();
    } else {
      this.updateStatusUi(false);
    }
  }

  getOrCreateDeviceId() {
    let id = localStorage.getItem('shopping_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
      localStorage.setItem('shopping_device_id', id);
    }
    return id;
  }

  getDefaultDeviceName() {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'iPhone';
    if (/android/.test(ua)) return 'Android';
    return 'Телефон';
  }

  getTopicName(code) {
    return 'remind_fam_room_' + (code || '').toLowerCase().trim();
  }

  initElements() {
    // Header trigger button & indicators
    this.openSyncBtn = document.getElementById('openSyncBtn');
    this.syncStatusDot = document.getElementById('syncStatusDot');
    this.familyRoomBanner = document.getElementById('familyRoomBanner');
    this.currentRoomCodeDisplay = document.getElementById('currentRoomCodeDisplay');
    this.syncPulseIndicator = document.getElementById('syncPulseIndicator');

    // Sync Modal Elements
    this.syncModal = document.getElementById('syncModal');
    this.closeSyncBtn = document.getElementById('closeSyncBtn');
    this.closeSyncBottomBtn = document.getElementById('closeSyncBottomBtn');

    // Room active state elements
    this.syncActiveState = document.getElementById('syncActiveState');
    this.syncDisconnectedState = document.getElementById('syncDisconnectedState');
    this.modalRoomCodeBig = document.getElementById('modalRoomCodeBig');
    this.syncStatusBadge = document.getElementById('syncStatusBadge');
    this.copyRoomLinkBtn = document.getElementById('copyRoomLinkBtn');
    this.shareRoomBtn = document.getElementById('shareRoomBtn');
    this.syncQrImage = document.getElementById('syncQrImage');
    this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
    this.newRoomFromActiveBtn = document.getElementById('newRoomFromActiveBtn');

    // Join room elements
    this.joinRoomCodeInput = document.getElementById('joinRoomCodeInput');
    this.joinRoomSubmitBtn = document.getElementById('joinRoomSubmitBtn');
    this.createRoomBtn = document.getElementById('createRoomBtn');
  }

  initEventListeners() {
    if (this.openSyncBtn) {
      this.openSyncBtn.addEventListener('click', () => this.openModal());
    }

    if (this.familyRoomBanner) {
      this.familyRoomBanner.addEventListener('click', () => this.openModal());
    }

    if (this.closeSyncBtn) {
      this.closeSyncBtn.addEventListener('click', () => this.closeModal());
    }

    if (this.closeSyncBottomBtn) {
      this.closeSyncBottomBtn.addEventListener('click', () => this.closeModal());
    }

    if (this.syncModal) {
      this.syncModal.addEventListener('click', (e) => {
        if (e.target === this.syncModal) this.closeModal();
      });
    }

    // Copy link
    if (this.copyRoomLinkBtn) {
      this.copyRoomLinkBtn.addEventListener('click', () => this.copyInviteLink());
    }

    // Share link via Web Share API
    if (this.shareRoomBtn) {
      this.shareRoomBtn.addEventListener('click', () => this.shareInvite());
    }

    // Leave room
    if (this.leaveRoomBtn) {
      this.leaveRoomBtn.addEventListener('click', () => {
        if (confirm('Отключить этот телефон от семейного списка? Вы вернётесь к личному списку покупок.')) {
          this.disconnect(true);
        }
      });
    }

    // Create room
    if (this.createRoomBtn) {
      this.createRoomBtn.addEventListener('click', () => this.createNewRoom());
    }
    if (this.newRoomFromActiveBtn) {
      this.newRoomFromActiveBtn.addEventListener('click', () => {
        if (confirm('Создать новый семейный код? Старая комната останется у тех, кто к ней подключен.')) {
          this.createNewRoom();
        }
      });
    }

    // Join room
    if (this.joinRoomSubmitBtn) {
      this.joinRoomSubmitBtn.addEventListener('click', () => this.handleJoinFromInput());
    }

    if (this.joinRoomCodeInput) {
      this.joinRoomCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleJoinFromInput();
      });
      // Auto-uppercase and sanitize room code
      this.joinRoomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      });
    }

    // Reconnect when page becomes visible again (e.g. phone unlocked)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.roomCode) {
        this.fetchLatestState();
        if (!this.isConnected) {
          this.connect();
        }
      }
    });

    // Reconnect when network returns
    window.addEventListener('online', () => {
      if (this.roomCode) {
        this.fetchLatestState();
        this.connect();
      }
    });
  }

  checkUrlForRoom() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room') || urlParams.get('list');
      if (roomParam) {
        const cleanRoom = roomParam.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        if (cleanRoom && cleanRoom !== this.roomCode) {
          this.joinRoom(cleanRoom, true);
        }
      }
    } catch (e) {
      console.warn('Error checking URL params:', e);
    }
  }

  generateRoomCode() {
    // Generate an easy-to-read, 4-digit numeric code like 4819
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  createNewRoom() {
    const newCode = this.generateRoomCode();
    this.joinRoom(newCode, false);
    // Immediately broadcast current local items to seed the new room
    setTimeout(() => {
      this.broadcastItems('Создан семейный список');
    }, 400);
  }

  handleJoinFromInput() {
    if (!this.joinRoomCodeInput) return;
    const code = this.joinRoomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    if (!code) {
      alert('Пожалуйста, введите 4-значный код комнаты (например: 7429)');
      return;
    }
    this.joinRoom(code, false);
  }

  joinRoom(code, fromUrl = false) {
    if (!code) return;
    this.roomCode = code.toUpperCase().trim();
    localStorage.setItem('shopping_family_room', this.roomCode);

    this.connect();
    this.fetchLatestState();
    this.renderModal();

    const msg = `👨‍👩‍👧 Подключено к семейному списку ${this.roomCode}!`;
    this.app.showToast(msg);
    if (window.soundEffects) {
      window.soundEffects.playAllDoneFanfare();
      window.soundEffects.vibrate([30, 40, 30]);
    }
  }

  disconnect(clearStorage = true) {
    if (this.eventSource) {
      try { this.eventSource.close(); } catch (e) {}
      this.eventSource = null;
    }
    clearTimeout(this.reconnectTimeout);
    this.isConnected = false;
    this.roomCode = null;

    if (clearStorage) {
      localStorage.removeItem('shopping_family_room');
    }

    this.updateStatusUi(false);
    this.renderModal();
    this.app.showToast('ℹ️ Семейная синхронизация отключена (личный список)');
  }

  connect() {
    if (!this.roomCode) return;

    if (this.eventSource) {
      try { this.eventSource.close(); } catch (e) {}
      this.eventSource = null;
    }
    clearTimeout(this.reconnectTimeout);

    const topic = this.getTopicName(this.roomCode);
    const sseUrl = `https://ntfy.sh/${topic}/sse`;

    try {
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.updateStatusUi(true);
      };

      this.eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this.handleInboundMessage(data);
        } catch (e) {
          // Heartbeat or malformed JSON
        }
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.updateStatusUi(false, true); // Reconnecting status
        if (this.eventSource) {
          try { this.eventSource.close(); } catch (e) {}
          this.eventSource = null;
        }
        // Auto-reconnect with safe delay
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          if (this.roomCode) this.connect();
        }, 4000);
      };
    } catch (err) {
      console.warn('EventSource initialization failed:', err);
      this.updateStatusUi(false, true);
    }
  }

  // Poll past messages to catch up on anything sent while offline / asleep
  async fetchLatestState() {
    if (!this.roomCode) return;
    const topic = this.getTopicName(this.roomCode);
    const pollUrl = `https://ntfy.sh/${topic}/json?poll=1&since=all`;

    try {
      const resp = await fetch(pollUrl);
      if (!resp.ok) return;
      const text = await resp.text();
      const lines = text.trim().split('\n').filter(Boolean);

      let latestSyncPayload = null;
      for (const line of lines) {
        try {
          const msgObj = JSON.parse(line);
          const payload = await this.extractPayloadFromNtfyMessage(msgObj);
          if (payload && payload.type === 'SYNC_ITEMS' && payload.timestamp) {
            if (!latestSyncPayload || payload.timestamp > latestSyncPayload.timestamp) {
              latestSyncPayload = payload;
            }
          }
        } catch (e) {}
      }

      if (latestSyncPayload) {
        this.applyInboundPayload(latestSyncPayload, false);
      }
    } catch (err) {
      console.warn('Failed to fetch latest room state:', err);
    }
  }

  // Helper: extracts payload whether ntfy stored it inline or as an attachment (for larger lists)
  async extractPayloadFromNtfyMessage(msgObj) {
    if (!msgObj || msgObj.event !== 'message') return null;

    // 1. Check if attachment was attached (happens when payload > 4KB)
    if (msgObj.attachment && msgObj.attachment.url) {
      try {
        const attResp = await fetch(msgObj.attachment.url);
        if (attResp.ok) {
          return await attResp.json();
        }
      } catch (e) {
        console.warn('Failed to download ntfy attachment:', e);
      }
    }

    // 2. Inline message
    if (msgObj.message) {
      try {
        return JSON.parse(msgObj.message);
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  async handleInboundMessage(data) {
    const payload = await this.extractPayloadFromNtfyMessage(data);
    if (payload && payload.type === 'SYNC_ITEMS') {
      this.applyInboundPayload(payload, true);
    }
  }

  applyInboundPayload(payload, showFeedback = true) {
    // Ignore echo from our own device
    if (payload.senderId === this.deviceId) return;

    // Check freshness
    if (payload.timestamp && payload.timestamp <= this.lastReceivedTimestamp) {
      return;
    }

    this.lastReceivedTimestamp = payload.timestamp || Date.now();

    if (Array.isArray(payload.items)) {
      this.isSyncingOutbound = true; // prevent re-broadcasting inbound items
      this.app.items = payload.items;
      try {
        localStorage.setItem('shopping_items_v1', JSON.stringify(this.app.items));
      } catch (e) {
        console.error('Error saving synced items:', e);
      }
      this.app.render();
      this.isSyncingOutbound = false;

      if (showFeedback) {
        const detail = payload.detail || 'Список обновлен';
        this.app.showToast(`👨‍👩‍👧 Семья: ${detail}`);
        if (window.soundEffects) {
          window.soundEffects.playFamilyBell();
        }
      }
    }
  }

  // Broadcast local changes to other family members
  broadcastItems(actionDetail = 'Обновление') {
    if (!this.roomCode || this.isSyncingOutbound) return;

    const topic = this.getTopicName(this.roomCode);
    const publishUrl = `https://ntfy.sh/${topic}`;

    const payload = {
      type: 'SYNC_ITEMS',
      roomId: this.roomCode,
      senderId: this.deviceId,
      senderName: this.deviceName,
      timestamp: Date.now(),
      detail: actionDetail,
      items: this.app.items
    };

    // Update local watermark
    this.lastReceivedTimestamp = payload.timestamp;

    // Strict ASCII-only headers (never pass Cyrillic into Title or other HTTP headers)
    fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Title': `Reminder Room ${this.roomCode}`,
        'Priority': 'default'
      },
      body: JSON.stringify(payload)
    }).catch(err => {
      console.warn('Sync publish failed:', err);
    });
  }

  updateStatusUi(connected, reconnecting = false) {
    if (this.syncStatusDot) {
      this.syncStatusDot.className = 'sync-status-dot';
      if (!this.roomCode) {
        this.syncStatusDot.classList.add('dot-disabled');
      } else if (connected) {
        this.syncStatusDot.classList.add('dot-connected');
      } else if (reconnecting) {
        this.syncStatusDot.classList.add('dot-reconnecting');
      } else {
        this.syncStatusDot.classList.add('dot-offline');
      }
    }

    if (this.familyRoomBanner) {
      if (this.roomCode) {
        this.familyRoomBanner.style.display = 'flex';
        if (this.currentRoomCodeDisplay) {
          this.currentRoomCodeDisplay.textContent = this.roomCode;
        }
        if (this.syncPulseIndicator) {
          this.syncPulseIndicator.textContent = connected ? '🟢 В сети' : (reconnecting ? '🟡 Подключение...' : '🔴 Офлайн');
        }
      } else {
        this.familyRoomBanner.style.display = 'none';
      }
    }

    if (this.syncStatusBadge) {
      if (this.roomCode) {
        this.syncStatusBadge.textContent = connected ? '🟢 Подключено (в сети)' : (reconnecting ? '🟡 Переподключение...' : '🔴 Нет связи');
        this.syncStatusBadge.style.color = connected ? '#10b981' : (reconnecting ? '#f59e0b' : '#ef4444');
      }
    }
  }

  getInviteUrl() {
    const base = window.location.origin + window.location.pathname;
    return `${base}?room=${encodeURIComponent(this.roomCode || '')}`;
  }

  async copyInviteLink() {
    if (!this.roomCode) return;
    const url = this.getInviteUrl();
    try {
      await navigator.clipboard.writeText(url);
      this.app.showToast('📋 Ссылка на семейный список скопирована!');
      if (this.copyRoomLinkBtn) {
        const orig = this.copyRoomLinkBtn.textContent;
        this.copyRoomLinkBtn.textContent = '✅ Скопировано!';
        setTimeout(() => { this.copyRoomLinkBtn.textContent = orig; }, 2000);
      }
    } catch (e) {
      prompt('Скопируйте ссылку для родных:', url);
    }
  }

  async shareInvite() {
    if (!this.roomCode) return;
    const url = this.getInviteUrl();
    const shareData = {
      title: 'Семейный список покупок',
      text: `🛒 Присоединяйся к нашему списку покупок! Код комнаты: ${this.roomCode}\n`,
      url: url
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') this.copyInviteLink();
      }
    } else {
      this.copyInviteLink();
    }
  }

  renderModal() {
    if (!this.syncModal) return;

    if (this.roomCode) {
      if (this.syncActiveState) this.syncActiveState.style.display = 'block';
      if (this.syncDisconnectedState) this.syncDisconnectedState.style.display = 'none';
      if (this.modalRoomCodeBig) this.modalRoomCodeBig.textContent = this.roomCode;

      // Generate QR code for instant phone scanning
      if (this.syncQrImage) {
        const url = this.getInviteUrl();
        this.syncQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
      }
    } else {
      if (this.syncActiveState) this.syncActiveState.style.display = 'none';
      if (this.syncDisconnectedState) this.syncDisconnectedState.style.display = 'block';
      if (this.joinRoomCodeInput) this.joinRoomCodeInput.value = '';
    }

    this.updateStatusUi(this.isConnected);
  }

  openModal() {
    if (!this.syncModal) return;
    this.renderModal();
    this.syncModal.classList.add('active');
  }

  closeModal() {
    if (this.syncModal) {
      this.syncModal.classList.remove('active');
    }
  }
}

// Make accessible to app
window.FamilySyncManager = FamilySyncManager;
