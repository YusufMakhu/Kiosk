/* ═══════════════════════════════════════════════════════════
   KLASSENKIOSK
   Verkaufen in 3 einfachen Schritten: Aussuchen → Bezahlen → Rückgeld
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // KONFIGURATION
  // ═══════════════════════════════════════════════════════════
  // Gleiche Speicher-Schlüssel wie Version 3 → vorhandene Daten bleiben erhalten.
  const PREFIX = 'klassenkiosk_v3_';
  const KEYS = {
    PRODUCTS: PREFIX + 'products',
    HISTORY: PREFIX + 'history',
    INVENTORY: PREFIX + 'inventory',
    SETTINGS: PREFIX + 'settings'
  };

  const MAX_HISTORY = 2000;
  const MAX_IMAGE_DIMENSION = 400;
  const MAX_GIVEN = 20000; // 200 €

  const DEFAULT_PRODUCTS = [
    { id: 'p_apfelschorle', name: 'Apfelschorle', price: 80, image: 'assets/images/products/apfelschorle.png' },
    { id: 'p_muesliriegel', name: 'Müsliriegel', price: 30, image: 'assets/images/products/muesliriegel.png' },
    { id: 'p_milchmaeuse', name: 'Milchmäuse', price: 5, image: 'assets/images/products/milchmaeuse.png' },
    { id: 'p_maoam', name: 'Maoam', price: 20, image: 'assets/images/products/maoam.png' },
    { id: 'p_goldbaeren', name: 'Goldbären', price: 20, image: 'assets/images/products/goldbaeren.png' },
    { id: 'p_kinderbueno', name: 'Kinderbueno', price: 60, image: 'assets/images/products/kinderbueno.png' },
    { id: 'p_trinkpaeckchen', name: 'Trinkpäckchen', price: 40, image: 'assets/images/products/trinkpaeckchen.png' },
    { id: 'p_schokoriegel', name: 'Schokoriegel', price: 30, image: 'assets/images/products/schokoriegel.png' },
    { id: 'p_schokobroetchen', name: 'Schokobrötchen', price: 40, image: 'assets/images/products/schokobroetchen.png' }
  ];

  const DEFAULT_SETTINGS = {
    speech: true,
    speechRate: '0.95',
    sound: true,
    changeHelp: true,
    showMath: true,
    priceCoins: false,
    smallCoins: false,
    bigNotes: false,
    celebrate: true,
    payMode: 'coins',
    textSize: 'normal',
    theme: 'light',
    usePin: true,
    pin: '1234'
  };

  // Euro-Münzen und -Scheine. size = echter Durchmesser in mm (für realistische Größenverhältnisse).
  const MONEY = [
    { value: 1, kind: 'coin', metal: 'copper', size: 16.25, top: '1', bottom: 'CENT', small: true },
    { value: 2, kind: 'coin', metal: 'copper', size: 18.75, top: '2', bottom: 'CENT', small: true },
    { value: 5, kind: 'coin', metal: 'copper', size: 21.25, top: '5', bottom: 'CENT' },
    { value: 10, kind: 'coin', metal: 'gold', size: 19.75, top: '10', bottom: 'CENT' },
    { value: 20, kind: 'coin', metal: 'gold', size: 22.25, top: '20', bottom: 'CENT' },
    { value: 50, kind: 'coin', metal: 'gold', size: 24.25, top: '50', bottom: 'CENT' },
    { value: 100, kind: 'coin', metal: 'euro1', size: 23.25, top: '1', bottom: 'EURO' },
    { value: 200, kind: 'coin', metal: 'euro2', size: 25.75, top: '2', bottom: 'EURO' },
    { value: 500, kind: 'note', color: '#8e9c94', dark: '#5f6d65', top: '5' },
    { value: 1000, kind: 'note', color: '#d0605a', dark: '#99403b', top: '10' },
    { value: 2000, kind: 'note', color: '#4f86c6', dark: '#2f5d93', top: '20' },
    { value: 5000, kind: 'note', color: '#e39a3b', dark: '#a8691c', top: '50', big: true }
  ];
  const MONEY_BY_VALUE = Object.fromEntries(MONEY.map(m => [m.value, m]));

  const PRAISE = [
    ['🎉', 'Super gemacht!'],
    ['🌟', 'Klasse!'],
    ['👏', 'Toll verkauft!'],
    ['🏆', 'Prima!'],
    ['😃', 'Sehr gut!'],
    ['💪', 'Stark!']
  ];

  // ═══════════════════════════════════════════════════════════
  // ZUSTAND
  // ═══════════════════════════════════════════════════════════
  const state = {
    products: [],
    history: [],
    inventory: {},
    settings: { ...DEFAULT_SETTINGS },
    cart: new Map(),       // productId → Anzahl (Reihenfolge = Reihenfolge des Antippens)
    step: 1,
    given: [],             // bekommene Münzen/Scheine (Werte in Cent)
    keypadText: '',        // Eingabe im Zahlenfeld
    changePieces: [],      // Rückgeld-Stücke (Werte in Cent)
    changeDone: new Set(), // Indizes der schon gegebenen Stücke
    editingId: null,
    historyFilter: 'today',
    chartDays: 7,
    tab: 'overview'
  };

  // ═══════════════════════════════════════════════════════════
  // HILFSFUNKTIONEN
  // ═══════════════════════════════════════════════════════════
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const euro = cents => EUR.format(cents / 100);

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // "1 Euro 60", "80 Cent", "2 Euro" – so wird Geld auch gesprochen.
  function moneyWords(cents) {
    const e = Math.floor(cents / 100);
    const c = cents % 100;
    if (e === 0) return `${c} Cent`;
    if (c === 0) return `${e} Euro`;
    return `${e} Euro ${c}`;
  }

  // "0,80" / "0.8" / "1" / "80 ct" → Cent
  function parseEuro(text) {
    const raw = String(text || '').trim().toLowerCase();
    if (!raw) return NaN;
    if (/ct|cent/.test(raw)) {
      const ct = parseInt(raw, 10);
      return Number.isFinite(ct) ? ct : NaN;
    }
    const num = parseFloat(raw.replace('€', '').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(num) ? Math.round(num * 100) : NaN;
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function isSameDay(a, b) {
    return new Date(a).toDateString() === new Date(b).toDateString();
  }

  function placeholderImage(label) {
    const text = esc((label || '?').trim().substring(0, 2).toUpperCase());
    const hue = label ? (label.charCodeAt(0) * 37) % 360 : 200;
    return 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="12" fill="hsl(${hue},55%,88%)"/><text x="50" y="62" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="bold" fill="hsl(${hue},45%,30%)">${text}</text></svg>`
    );
  }

  function productImage(p) {
    return p && p.image ? p.image : placeholderImage(p ? p.name : '?');
  }

  // Zerlegt einen Betrag in möglichst wenige Münzen/Scheine.
  function breakdown(cents, values) {
    const list = (values || MONEY.map(m => m.value)).slice().sort((a, b) => b - a);
    const pieces = [];
    let rest = cents;
    for (const v of list) {
      while (rest >= v) {
        pieces.push(v);
        rest -= v;
      }
    }
    return pieces;
  }

  // ═══════════════════════════════════════════════════════════
  // GELD ALS BILD (SVG)
  // ═══════════════════════════════════════════════════════════
  const METALS = {
    copper: { outer: '#c06a3b', inner: '#d9864f', edge: '#8a4520', text: '#5a2a10' },
    gold: { outer: '#d9ab35', inner: '#ecc55a', edge: '#9c7512', text: '#5e4506' },
    euro1: { outer: '#d9ab35', inner: '#cfd3d8', edge: '#8b8f96', text: '#34383e' },
    euro2: { outer: '#cfd3d8', inner: '#e3b84a', edge: '#8b8f96', text: '#4a3505' }
  };

  function moneySVG(value) {
    const m = MONEY_BY_VALUE[value];
    if (!m) return '';
    if (m.kind === 'note') {
      return `<svg viewBox="0 0 170 90" role="img" aria-label="${m.top} Euro Schein" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="166" height="86" rx="8" fill="${m.color}" stroke="${m.dark}" stroke-width="3"/>
        <rect x="112" y="2" width="22" height="86" fill="${m.dark}" opacity="0.25"/>
        <circle cx="140" cy="45" r="22" fill="#fff" opacity="0.25"/>
        <text x="14" y="58" font-family="Arial,sans-serif" font-weight="bold" font-size="${m.top.length > 1 ? 42 : 48}" fill="#fff">${m.top}</text>
        <text x="${m.top.length > 1 ? 66 : 46}" y="58" font-family="Arial,sans-serif" font-weight="bold" font-size="30" fill="#fff">€</text>
        <text x="14" y="80" font-family="Arial,sans-serif" font-weight="bold" font-size="13" fill="#fff" opacity="0.9">EURO</text>
        <text x="140" y="54" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="24" fill="${m.dark}">${m.top}</text>
      </svg>`;
    }
    const c = METALS[m.metal];
    const r = 48 * (m.size / 25.75);
    const inner = m.metal.startsWith('euro') ? r * 0.72 : r * 0.86;
    const big = m.top.length > 1 ? r * 0.62 : r * 0.8;
    return `<svg viewBox="0 0 100 100" role="img" aria-label="${m.top} ${m.bottom === 'EURO' ? 'Euro' : 'Cent'}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="${r}" fill="${c.outer}" stroke="${c.edge}" stroke-width="2.5"/>
      <circle cx="50" cy="50" r="${inner}" fill="${c.inner}"/>
      <text x="50" y="${50 + big * 0.28}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="${big}" fill="${c.text}">${m.top}</text>
      <text x="50" y="${50 + r * 0.62}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="${Math.max(r * 0.22, 7)}" fill="${c.text}">${m.bottom}</text>
    </svg>`;
  }

  function moneyLabel(value) {
    return value >= 100 ? `${value / 100} €` : `${value} Cent`;
  }

  // ═══════════════════════════════════════════════════════════
  // SPEICHER
  // ═══════════════════════════════════════════════════════════
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      if (e && e.name === 'QuotaExceededError') toast('Speicher voll! Bitte alten Verlauf löschen.', 'error');
      return false;
    }
  }

  const saveProducts = () => save(KEYS.PRODUCTS, state.products);
  const saveHistory = () => save(KEYS.HISTORY, state.history);
  const saveInventory = () => save(KEYS.INVENTORY, state.inventory);
  const saveSettings = () => save(KEYS.SETTINGS, state.settings);

  function loadAll() {
    const products = load(KEYS.PRODUCTS, null);
    state.products = Array.isArray(products) ? products : DEFAULT_PRODUCTS.map(p => ({ ...p }));
    const history = load(KEYS.HISTORY, []);
    state.history = Array.isArray(history) ? history : [];
    const inventory = load(KEYS.INVENTORY, {});
    state.inventory = inventory && typeof inventory === 'object' ? inventory : {};

    const stored = load(KEYS.SETTINGS, {}) || {};
    state.settings = { ...DEFAULT_SETTINGS, ...stored };
    // Übernahme aus Version 3
    if (stored.soundEnabled === false && stored.sound === undefined) state.settings.sound = false;
    delete state.settings.soundEnabled;
  }

  // ═══════════════════════════════════════════════════════════
  // TÖNE (ohne externe Bibliothek, funktioniert offline)
  // ═══════════════════════════════════════════════════════════
  let audioCtx = null;
  const TONES = {
    add: [660],
    remove: [392],
    coin: [880],
    enough: [659, 880],
    tick: [988],
    success: [523, 659, 784, 1047],
    error: [220, 196]
  };

  function sound(type) {
    if (!state.settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const notes = TONES[type] || TONES.add;
      const t0 = audioCtx.currentTime;
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const start = t0 + i * 0.09;
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch (e) { /* kein Ton möglich */ }
  }

  // ═══════════════════════════════════════════════════════════
  // VORLESEN
  // ═══════════════════════════════════════════════════════════
  let germanVoice = null;

  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    germanVoice = voices.find(v => v.lang === 'de-DE' && v.localService) ||
                  voices.find(v => v.lang && v.lang.toLowerCase().startsWith('de')) || null;
  }

  function speak(text, force) {
    if ((!state.settings.speech && !force) || !('speechSynthesis' in window) || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      if (germanVoice) u.voice = germanVoice;
      u.rate = parseFloat(state.settings.speechRate) || 0.95;
      speechSynthesis.speak(u);
    } catch (e) { /* Vorlesen nicht möglich */ }
  }

  // ═══════════════════════════════════════════════════════════
  // MELDUNGEN & DIALOGE
  // ═══════════════════════════════════════════════════════════
  function toast(message, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = message;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // Großer Ja/Nein-Dialog statt window.confirm
  function ask(text, { icon = '❓', yes = 'Ja', no = 'Nein', danger = false, say = true } = {}) {
    const dlg = $('#confirmDialog');
    $('#confirmIcon').textContent = icon;
    $('#confirmText').textContent = text;
    $('#confirmYes').textContent = yes;
    $('#confirmNo').textContent = no;
    $('#confirmYes').classList.toggle('btn-danger-go', danger);
    if (say) speak(text);
    return new Promise(resolve => {
      const yesBtn = $('#confirmYes');
      const noBtn = $('#confirmNo');
      const finish = (e, value) => {
        if (e) e.preventDefault();
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        dlg.removeEventListener('cancel', onNo);
        if (dlg.open) dlg.close();
        resolve(value);
      };
      const onYes = e => finish(e, true);
      const onNo = e => finish(e, false);
      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
      dlg.addEventListener('cancel', onNo);
      dlg.showModal();
      noBtn.focus();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // EINSTELLUNGEN ANWENDEN
  // ═══════════════════════════════════════════════════════════
  function applySettings() {
    const s = state.settings;
    const root = document.documentElement;
    root.dataset.theme = s.theme;
    root.dataset.textSize = s.textSize;
    const themeColor = { light: '#f6f3ec', dark: '#161a23', contrast: '#000000' }[s.theme] || '#f6f3ec';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeColor);

    $('#speechToggle').setAttribute('aria-pressed', String(!!s.speech));
    $('#speechToggle').hidden = !('speechSynthesis' in window);

    $$('[data-setting]').forEach(input => { input.checked = !!s[input.dataset.setting]; });
    $$('[data-setting-choice]').forEach(group => {
      const key = group.dataset.settingChoice;
      group.querySelectorAll('.seg').forEach(b => b.classList.toggle('active', String(s[key]) === b.dataset.value));
    });
  }

  function setSetting(key, value) {
    state.settings[key] = value;
    saveSettings();
    applySettings();
    // Ansichten neu zeichnen, die von Einstellungen abhängen
    renderProductsGrid();
    renderMoneyPad();
    if (state.step === 2) renderPayment();
    if (state.step === 3) renderChange();
  }

  // ═══════════════════════════════════════════════════════════
  // SCHRITTE
  // ═══════════════════════════════════════════════════════════
  function cartTotals() {
    let items = 0;
    let cents = 0;
    state.cart.forEach((qty, id) => {
      const p = state.products.find(x => x.id === id);
      if (!p) return;
      items += qty;
      cents += qty * p.price;
    });
    return { items, cents };
  }

  function givenCents() {
    if (state.settings.payMode === 'keypad') {
      const v = parseEuro(state.keypadText);
      return Number.isFinite(v) ? v : 0;
    }
    return state.given.reduce((a, b) => a + b, 0);
  }

  function hintText(step) {
    const due = cartTotals().cents;
    if (step === 1) {
      return 'Tippe auf die Sachen, die der Kunde kaufen möchte.';
    }
    if (step === 2) {
      return state.settings.payMode === 'keypad'
        ? `Der Kunde muss ${euro(due)} bezahlen. Tippe ein, wie viel Geld du bekommst.`
        : `Der Kunde muss ${euro(due)} bezahlen. Tippe auf das Geld, das du bekommst.`;
    }
    const change = givenCents() - due;
    return change > 0
      ? `Gib dem Kunden ${euro(change)} zurück.`
      : 'Passend bezahlt! Du musst nichts zurückgeben.';
  }

  function hintSpeech(step) {
    const due = cartTotals().cents;
    if (step === 1) return hintText(1);
    if (step === 2) {
      return state.settings.payMode === 'keypad'
        ? `Der Kunde muss ${moneyWords(due)} bezahlen. Tippe ein, wie viel Geld du bekommst.`
        : `Der Kunde muss ${moneyWords(due)} bezahlen. Tippe auf das Geld, das du bekommst.`;
    }
    const change = givenCents() - due;
    return change > 0
      ? `Gib dem Kunden ${moneyWords(change)} zurück.`
      : 'Passend bezahlt! Du musst nichts zurückgeben.';
  }

  function goStep(step, { silent = false } = {}) {
    const totals = cartTotals();
    if (step > 1 && totals.items === 0) step = 1;
    if (step === 3 && givenCents() < totals.cents) step = 2;

    const from = state.step;
    state.step = step;

    $$('#screen-sell .step').forEach(s => { s.hidden = Number(s.dataset.step) !== step; });
    $$('#stepper li').forEach(li => {
      const n = Number(li.dataset.step);
      li.classList.toggle('current', n === step);
      li.classList.toggle('done', n < step);
      if (n === step) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });

    if (step === 1) {
      renderProductsGrid();
      renderCart();
    }
    if (step === 2) {
      if (from === 1) {
        state.given = [];
        state.keypadText = '';
      }
      renderPayment();
    }
    if (step === 3) {
      prepareChange();
      renderChange();
    }

    $(`#hint-${step}`).textContent = hintText(step);
    if (!silent) speak(hintSpeech(step));
  }

  // ═══════════════════════════════════════════════════════════
  // SCHRITT 1: AUSSUCHEN
  // ═══════════════════════════════════════════════════════════
  function visibleProducts() {
    return state.products.filter(p => !p.hidden);
  }

  function renderProductsGrid() {
    const grid = $('#productsGrid');
    const products = visibleProducts();
    if (products.length === 0) {
      grid.innerHTML = `<div class="empty">Noch keine Produkte. Der Lehrer kann Produkte im Lehrerbereich anlegen.</div>`;
      return;
    }
    grid.innerHTML = products.map(p => {
      const qty = state.cart.get(p.id) || 0;
      const coins = state.settings.priceCoins
        ? `<span class="product-coins" aria-hidden="true">${breakdown(p.price, [200, 100, 50, 20, 10, 5, 2, 1]).map(moneySVG).join('')}</span>`
        : '';
      return `
        <div class="product ${qty ? 'in-cart' : ''}" data-id="${esc(p.id)}">
          <button class="product-add" data-action="add" aria-label="${esc(p.name)}, ${esc(euro(p.price))}. Antippen zum Hinzufügen.">
            <img class="product-img" src="${esc(productImage(p))}" alt="${esc(p.name)}" draggable="false">
            <span class="product-name">${esc(p.name)}</span>
            <span class="product-price">${euro(p.price)}</span>
            ${coins}
          </button>
          <span class="product-qty" ${qty ? '' : 'hidden'}>${qty}</span>
          <button class="product-minus" data-action="minus" aria-label="Ein ${esc(p.name)} weniger" ${qty ? '' : 'hidden'}>−</button>
        </div>`;
    }).join('');
  }

  function updateProductCard(id) {
    const card = $('#productsGrid').querySelector(`.product[data-id="${CSS.escape(id)}"]`);
    if (!card) return;
    const qty = state.cart.get(id) || 0;
    card.classList.toggle('in-cart', qty > 0);
    card.querySelector('.product-qty').textContent = qty;
    card.querySelector('.product-qty').hidden = qty === 0;
    card.querySelector('.product-minus').hidden = qty === 0;
    card.classList.remove('pop');
    void card.offsetWidth; // Animation neu starten
    card.classList.add('pop');
  }

  function addToCart(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    state.cart.set(id, (state.cart.get(id) || 0) + 1);
    sound('add');
    speak(`${p.name}. ${moneyWords(p.price)}.`);
    updateProductCard(id);
    renderCart();
  }

  function removeFromCart(id) {
    const p = state.products.find(x => x.id === id);
    const qty = state.cart.get(id) || 0;
    if (!qty) return;
    if (qty === 1) state.cart.delete(id);
    else state.cart.set(id, qty - 1);
    sound('remove');
    if (p) speak(`Einmal weniger: ${p.name}.`);
    updateProductCard(id);
    renderCart();
  }

  function renderCart() {
    const list = $('#cartList');
    const totals = cartTotals();

    if (totals.items === 0) {
      list.innerHTML = `<li class="cart-empty"><span class="cart-empty-icon" aria-hidden="true">🛒</span>Der Korb ist leer.</li>`;
    } else {
      list.innerHTML = Array.from(state.cart.entries()).map(([id, qty]) => {
        const p = state.products.find(x => x.id === id);
        if (!p) return '';
        return `
          <li class="cart-item">
            <img src="${esc(productImage(p))}" alt="">
            <div>
              <div class="cart-item-name">${esc(p.name)}</div>
              <div class="cart-item-sub">${qty} × ${euro(p.price)}</div>
            </div>
            <div class="cart-item-sum">${euro(qty * p.price)}</div>
          </li>`;
      }).join('');
      list.scrollTop = list.scrollHeight;
      list.scrollLeft = list.scrollWidth;
    }

    $('#cartTotal').textContent = euro(totals.cents);
    $('#toPayBtn').disabled = totals.items === 0;
    $('#clearCartBtn').disabled = totals.items === 0;
  }

  async function clearCart() {
    if (cartTotals().items === 0) return;
    const ok = await ask('Alles aus dem Korb nehmen?', { icon: '🗑️' });
    if (!ok) return;
    state.cart.clear();
    sound('remove');
    renderProductsGrid();
    renderCart();
  }

  // ═══════════════════════════════════════════════════════════
  // SCHRITT 2: BEZAHLEN
  // ═══════════════════════════════════════════════════════════
  function payValues() {
    return MONEY.filter(m => (!m.small || state.settings.smallCoins) && (!m.big || state.settings.bigNotes));
  }

  function renderMoneyPad() {
    const pad = $('#moneyPad');
    const list = payValues();
    const coins = list.filter(m => m.kind === 'coin');
    const notes = list.filter(m => m.kind === 'note');
    const btn = m => `
      <button class="money-btn ${m.kind}" data-value="${m.value}" aria-label="${moneyLabel(m.value)}">
        ${moneySVG(m.value)}
        <span class="money-btn-label">${moneyLabel(m.value)}</span>
      </button>`;
    pad.innerHTML =
      `<div class="money-group-title">Münzen</div>${coins.map(btn).join('')}` +
      `<div class="money-group-title">Scheine</div>${notes.map(btn).join('')}`;

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];
    $('#numKeys').innerHTML = keys.map(k =>
      `<button class="num-key" data-key="${k}" aria-label="${k === '⌫' ? 'Löschen' : k === ',' ? 'Komma' : k}">${k}</button>`
    ).join('');
  }

  function renderPayment() {
    const due = cartTotals().cents;
    const given = givenCents();
    const keypad = state.settings.payMode === 'keypad';

    $('#moneyPad').hidden = keypad;
    $('#numPad').hidden = !keypad;
    $('#givenTray').hidden = keypad;
    $('#undoMoneyBtn').hidden = keypad;

    $('#dueAmount').textContent = euro(due);
    $('#givenAmount').textContent = euro(given);
    $('#numDisplay').textContent = (state.keypadText || '0') + ' €';

    // Bekommenes Geld als Bilder (antippen = wieder wegnehmen)
    $('#givenTray').innerHTML = state.given.map((v, i) => {
      const m = MONEY_BY_VALUE[v];
      const isNew = state.justAdded && i === state.given.length - 1;
      return `<button class="tray-money ${m.kind}${isNew ? ' new' : ''}" data-index="${i}" aria-label="${moneyLabel(v)} wegnehmen">${moneySVG(v)}</button>`;
    }).join('');

    const enough = given >= due;
    const status = $('#payStatus');
    status.classList.toggle('ok', enough);
    status.textContent = given === 0
      ? `Noch ${euro(due)}`
      : enough ? '✓ Genug Geld! Tippe auf „Weiter“.' : `Es fehlen noch ${euro(due - given)}`;

    const meter = $('#payMeter');
    meter.style.width = Math.min(100, due ? (given / due) * 100 : 0) + '%';
    meter.classList.toggle('ok', enough);

    $('#toChangeBtn').disabled = !enough;
    $('#undoMoneyBtn').disabled = state.given.length === 0;
    $('#hint-2').textContent = hintText(2);
  }

  function afterMoneyChange(spokenPrefix) {
    const due = cartTotals().cents;
    const before = state._wasEnough;
    renderPayment();
    const given = givenCents();
    const enough = given >= due;
    state._wasEnough = enough;
    if (enough && !before) {
      sound('enough');
      speak(`${spokenPrefix ? spokenPrefix + '. ' : ''}Genug Geld. Tippe auf Weiter.`);
    } else if (spokenPrefix) {
      speak(enough ? spokenPrefix : `${spokenPrefix}. Es fehlen noch ${moneyWords(due - given)}.`);
    }
  }

  function addMoney(value) {
    if (givenCents() + value > MAX_GIVEN) {
      sound('error');
      toast('Das ist zu viel Geld.', 'error');
      return;
    }
    state.given.push(value);
    sound('coin');
    state.justAdded = true;
    afterMoneyChange(moneyWords(value));
    state.justAdded = false;
  }

  function removeMoney(index) {
    const [v] = state.given.splice(index, 1);
    if (v === undefined) return;
    sound('remove');
    afterMoneyChange(`${moneyWords(v)} weg`);
  }

  function keypadPress(key) {
    let t = state.keypadText;
    if (key === '⌫') {
      t = t.slice(0, -1);
    } else if (key === ',') {
      if (!t.includes(',')) t = (t || '0') + ',';
    } else {
      const [, dec] = t.split(',');
      if (dec !== undefined && dec.length >= 2) return;
      if (t === '0') t = '';
      t += key;
    }
    if (parseEuro(t) > MAX_GIVEN) return;
    state.keypadText = t;
    sound('tick');
    afterMoneyChange('');
  }

  function payExact() {
    const due = cartTotals().cents;
    if (state.settings.payMode === 'keypad') {
      state.keypadText = (due / 100).toFixed(2).replace('.', ',');
    } else {
      state.given = breakdown(due, payValues().map(m => m.value).concat([1, 2]));
    }
    state._wasEnough = false;
    afterMoneyChange('Passend bezahlt');
  }

  // ═══════════════════════════════════════════════════════════
  // SCHRITT 3: RÜCKGELD
  // ═══════════════════════════════════════════════════════════
  function prepareChange() {
    const change = givenCents() - cartTotals().cents;
    state.changePieces = change > 0 ? breakdown(change) : [];
    state.changeDone = new Set();
  }

  function renderChange() {
    const due = cartTotals().cents;
    const given = givenCents();
    const change = Math.max(0, given - due);
    const help = state.settings.changeHelp;

    $('#changeAmount').textContent = euro(change);
    $('#hint-3').textContent = hintText(3);

    const instruction = $('#changeInstruction');
    const money = $('#changeMoney');

    if (change === 0) {
      instruction.textContent = 'Kein Rückgeld. Alles passt!';
      money.innerHTML = '<div class="change-none" aria-hidden="true">👍</div>';
    } else if (help) {
      instruction.textContent = 'Nimm dieses Geld aus der Kasse. Tippe auf jedes Stück, wenn du es gegeben hast.';
      money.innerHTML = state.changePieces.map((v, i) => {
        const m = MONEY_BY_VALUE[v];
        const done = state.changeDone.has(i);
        return `<button class="change-piece ${m.kind} ${done ? 'given' : ''}" data-index="${i}" aria-pressed="${done}" aria-label="${moneyLabel(v)}">
          ${moneySVG(v)}<span class="change-piece-label">${moneyLabel(v)}</span></button>`;
      }).join('');
    } else {
      instruction.textContent = 'Nimm das Rückgeld aus der Kasse.';
      money.innerHTML = '';
    }

    const math = $('#changeMath');
    math.hidden = !state.settings.showMath;
    math.textContent = `${euro(given)} bekommen − ${euro(due)} Preis = ${euro(change)} Rückgeld`;
  }

  function toggleChangePiece(index) {
    if (state.changeDone.has(index)) {
      state.changeDone.delete(index);
    } else {
      state.changeDone.add(index);
      sound('tick');
      const left = state.changePieces.length - state.changeDone.size;
      speak(left === 0 ? 'Alles Rückgeld gegeben. Tippe auf Fertig.' : moneyWords(state.changePieces[index]));
      if (left === 0) sound('enough');
    }
    renderChange();
  }

  async function finishSale() {
    const totals = cartTotals();
    const given = givenCents();
    if (totals.items === 0 || given < totals.cents) return;

    const needsTicks = state.settings.changeHelp && state.changePieces.length > 0;
    if (needsTicks && state.changeDone.size < state.changePieces.length) {
      const ok = await ask('Hast du das ganze Rückgeld gegeben?', { icon: '🪙', yes: 'Ja, fertig', no: 'Noch nicht' });
      if (!ok) return;
    }

    recordTransaction(totals, given);
    celebrate();

    state.cart.clear();
    state.given = [];
    state.keypadText = '';
    state._wasEnough = false;
    goStep(1, { silent: true });
  }

  function recordTransaction(totals, given) {
    const items = Array.from(state.cart.entries()).map(([id, qty]) => {
      const p = state.products.find(x => x.id === id);
      return p ? { id: p.id, name: p.name, price: p.price, qty, subtotal: p.price * qty } : null;
    }).filter(Boolean);

    state.history.unshift({
      id: uid('tx_'),
      timestamp: new Date().toISOString(),
      items,
      total: totals.cents,
      itemCount: totals.items,
      given,
      change: given - totals.cents
    });
    if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
    saveHistory();
  }

  let celebrateTimer = null;
  function celebrate() {
    sound('success');
    if (!state.settings.celebrate) {
      toast('✅ Verkauf gespeichert');
      speak('Verkauf gespeichert. Nächster Kunde.');
      return;
    }
    const [icon, text] = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    $('#celebrateIcon').textContent = icon;
    $('#celebrateText').textContent = text;
    const el = $('#celebrate');
    el.hidden = false;
    speak(`${text} Nächster Kunde.`);
    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(() => { el.hidden = true; }, 1800);
  }

  // ═══════════════════════════════════════════════════════════
  // LEHRERBEREICH: ZUGANG
  // ═══════════════════════════════════════════════════════════
  let pinEntry = '';

  function openTeacher() {
    if (!state.settings.usePin) {
      showScreen('teacher');
      return;
    }
    pinEntry = '';
    renderPinDots();
    $('#pinDialog').showModal();
  }

  function renderPinDots() {
    $$('#pinDots span').forEach((dot, i) => dot.classList.toggle('filled', i < pinEntry.length));
  }

  function pinPress(key) {
    if (key === '⌫') pinEntry = pinEntry.slice(0, -1);
    else if (pinEntry.length < 4) pinEntry += key;
    renderPinDots();
    if (pinEntry.length === 4) {
      if (pinEntry === String(state.settings.pin)) {
        $('#pinDialog').close();
        showScreen('teacher');
      } else {
        sound('error');
        const dots = $('#pinDots');
        dots.classList.remove('wrong');
        void dots.offsetWidth;
        dots.classList.add('wrong');
        setTimeout(() => { pinEntry = ''; renderPinDots(); }, 350);
      }
    }
  }

  function showScreen(name) {
    $('#app').dataset.screen = name;
    $('#screen-sell').hidden = name !== 'sell';
    $('#screen-teacher').hidden = name !== 'teacher';
    $('#teacherBtn').innerHTML = name === 'teacher'
      ? '<span aria-hidden="true">🛒</span><span class="icon-btn-label">Verkauf</span>'
      : '<span aria-hidden="true">🔒</span><span class="icon-btn-label">Lehrer</span>';
    $('#teacherBtn').title = name === 'teacher' ? 'Zurück zum Verkauf' : 'Lehrerbereich';
    if (name === 'teacher') {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      showTab(state.tab);
    } else {
      // Produkte könnten geändert worden sein → Korb bereinigen
      state.cart.forEach((qty, id) => {
        const p = state.products.find(x => x.id === id);
        if (!p || p.hidden) state.cart.delete(id);
      });
      renderMoneyPad();
      goStep(state.step === 3 ? 2 : state.step, { silent: true });
    }
  }

  function showTab(tab) {
    state.tab = tab;
    $$('.teacher-tabs .tab[data-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    });
    $$('#screen-teacher .panel').forEach(p => { p.hidden = p.id !== `panel-${tab}`; });
    if (tab === 'overview') renderOverview();
    if (tab === 'history') renderHistory();
    if (tab === 'products') renderManageList();
    if (tab === 'shopping') renderShopping();
    if (tab === 'settings') applySettings();
  }

  // ═══════════════════════════════════════════════════════════
  // LEHRERBEREICH: ÜBERSICHT
  // ═══════════════════════════════════════════════════════════
  function renderOverview() {
    const today = new Date();
    const tx = state.history.filter(t => isSameDay(t.timestamp, today));
    const revenue = tx.reduce((s, t) => s + t.total, 0);
    const items = tx.reduce((s, t) => s + t.itemCount, 0);
    $('#statRevenue').textContent = euro(revenue);
    $('#statSales').textContent = tx.length;
    $('#statItems').textContent = items;
    $('#statAvg').textContent = euro(tx.length ? Math.round(revenue / tx.length) : 0);
    renderChart();
    renderTopProducts();
  }

  function renderChart() {
    const days = state.chartDays;
    const today = new Date();
    const cols = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const sum = state.history.filter(t => isSameDay(t.timestamp, d)).reduce((s, t) => s + t.total, 0);
      cols.push({ d, sum, isToday: i === 0 });
    }
    const max = Math.max(1, ...cols.map(c => c.sum));
    $('#revenueChart').innerHTML = cols.map((c, i) => {
      const label = days === 7
        ? c.d.toLocaleDateString('de-DE', { weekday: 'short' })
        : (i % 5 === 0 || c.isToday ? c.d.getDate() + '.' : '');
      const val = days === 7 && c.sum ? euro(c.sum) : '';
      return `<div class="chart-col" title="${c.d.toLocaleDateString('de-DE')}: ${euro(c.sum)}">
        <span class="chart-val">${val}</span>
        <div class="chart-bar ${c.isToday ? 'today' : ''}" style="height:${(c.sum / max) * 80}%"></div>
        <span class="chart-label">${label}</span>
      </div>`;
    }).join('');
  }

  function renderTopProducts() {
    const sales = {};
    state.history.forEach(t => t.items.forEach(it => {
      sales[it.id] = sales[it.id] || { id: it.id, name: it.name, qty: 0, revenue: 0 };
      sales[it.id].qty += it.qty;
      sales[it.id].revenue += it.subtotal;
    }));
    const top = Object.values(sales).sort((a, b) => b.qty - a.qty).slice(0, 5);
    if (!top.length) {
      $('#topProducts').innerHTML = '<li class="empty">Noch keine Verkäufe.</li>';
      return;
    }
    const medals = ['🥇', '🥈', '🥉', '4', '5'];
    $('#topProducts').innerHTML = top.map((p, i) => {
      const product = state.products.find(x => x.id === p.id);
      return `<li>
        <span class="top-rank">${medals[i]}</span>
        <img src="${esc(productImage(product || { name: p.name }))}" alt="">
        <span><strong>${esc(p.name)}</strong><br><span class="top-qty">${p.qty}× verkauft</span></span>
        <span class="top-sum">${euro(p.revenue)}</span>
      </li>`;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════
  // LEHRERBEREICH: VERLAUF
  // ═══════════════════════════════════════════════════════════
  function renderHistory() {
    const filter = state.historyFilter;
    const now = new Date();
    const limit = new Date(now);
    if (filter === 'week') limit.setDate(limit.getDate() - 6);
    if (filter === 'month') limit.setDate(limit.getDate() - 29);
    limit.setHours(0, 0, 0, 0);

    const list = state.history.filter(t => {
      if (filter === 'all') return true;
      if (filter === 'today') return isSameDay(t.timestamp, now);
      return new Date(t.timestamp) >= limit;
    });

    $$('#historyFilter .seg').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));

    if (!list.length) {
      $('#historyList').innerHTML = '<div class="empty">📜<br>Keine Verkäufe in diesem Zeitraum.</div>';
      return;
    }

    const groups = new Map();
    list.forEach(t => {
      const key = new Date(t.timestamp).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    });

    let html = '';
    groups.forEach((txs, day) => {
      const sum = txs.reduce((s, t) => s + t.total, 0);
      html += `<div class="history-day">
        <div class="history-day-head"><span>${esc(day)}</span><span>${txs.length} Verkäufe · ${euro(sum)}</span></div>
        ${txs.map(t => `
          <div class="history-item">
            <span class="history-time">${new Date(t.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
            <div>
              <div class="history-items">${t.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}</div>
              ${t.given ? `<div class="history-pay">bekommen ${euro(t.given)} · Rückgeld ${euro(t.change || 0)}</div>` : ''}
            </div>
            <span class="history-sum">${euro(t.total)}</span>
            <button class="history-del" data-id="${esc(t.id)}" aria-label="Verkauf löschen" title="Verkauf löschen">🗑️</button>
          </div>`).join('')}
      </div>`;
    });
    $('#historyList').innerHTML = html;
  }

  async function deleteTransaction(id) {
    const ok = await ask('Diesen Verkauf löschen?', { icon: '🗑️', danger: true, say: false });
    if (!ok) return;
    state.history = state.history.filter(t => t.id !== id);
    saveHistory();
    renderHistory();
    toast('Verkauf gelöscht');
  }

  // ═══════════════════════════════════════════════════════════
  // LEHRERBEREICH: PRODUKTE
  // ═══════════════════════════════════════════════════════════
  function renderManageList() {
    const n = state.products.length;
    $('#productCount').textContent = `${n} ${n === 1 ? 'Produkt' : 'Produkte'}`;
    if (!n) {
      $('#manageList').innerHTML = '<li class="empty">Noch keine Produkte.</li>';
      return;
    }
    $('#manageList').innerHTML = state.products.map((p, i) => `
      <li class="manage-item ${p.hidden ? 'is-hidden' : ''}" data-id="${esc(p.id)}">
        <img src="${esc(productImage(p))}" alt="">
        <div>
          <div class="manage-name">${esc(p.name)}${p.hidden ? ' <small>(ausgeblendet)</small>' : ''}</div>
          <div class="manage-price">${euro(p.price)}</div>
        </div>
        <div class="manage-actions">
          <button class="mini-btn" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben" title="Nach oben">⬆️</button>
          <button class="mini-btn" data-act="down" ${i === n - 1 ? 'disabled' : ''} aria-label="Nach unten" title="Nach unten">⬇️</button>
          <button class="mini-btn" data-act="edit" aria-label="Bearbeiten" title="Bearbeiten">✏️</button>
          <button class="mini-btn" data-act="hide" aria-label="${p.hidden ? 'Einblenden' : 'Ausblenden'}" title="${p.hidden ? 'Einblenden' : 'Ausblenden'}">${p.hidden ? '🙈' : '👁️'}</button>
          <button class="mini-btn" data-act="delete" aria-label="Löschen" title="Löschen">🗑️</button>
        </div>
      </li>`).join('');
  }

  async function manageAction(id, act) {
    const i = state.products.findIndex(p => p.id === id);
    if (i < 0) return;
    const p = state.products[i];

    if (act === 'up' && i > 0) {
      [state.products[i - 1], state.products[i]] = [state.products[i], state.products[i - 1]];
    } else if (act === 'down' && i < state.products.length - 1) {
      [state.products[i + 1], state.products[i]] = [state.products[i], state.products[i + 1]];
    } else if (act === 'hide') {
      p.hidden = !p.hidden;
      toast(p.hidden ? `„${p.name}“ ausgeblendet` : `„${p.name}“ wieder sichtbar`);
    } else if (act === 'edit') {
      startEdit(p);
      return;
    } else if (act === 'delete') {
      const ok = await ask(`„${p.name}“ wirklich löschen?`, { icon: '🗑️', danger: true, say: false });
      if (!ok) return;
      state.products.splice(i, 1);
      state.cart.delete(id);
      delete state.inventory[id];
      saveInventory();
      if (state.editingId === id) cancelEdit();
      toast(`„${p.name}“ gelöscht`);
    }
    saveProducts();
    renderManageList();
  }

  function startEdit(p) {
    state.editingId = p.id;
    $('#productFormTitle').textContent = `„${p.name}“ bearbeiten`;
    $('#pfName').value = p.name;
    $('#pfPrice').value = (p.price / 100).toFixed(2).replace('.', ',');
    $('#pfImage').value = '';
    $('#pfSubmit').textContent = '💾 Speichern';
    $('#pfCancel').hidden = false;
    updatePricePreview();
    $('#productForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#pfName').focus();
  }

  function cancelEdit() {
    state.editingId = null;
    $('#productForm').reset();
    $('#productFormTitle').textContent = 'Neues Produkt';
    $('#pfSubmit').textContent = '➕ Hinzufügen';
    $('#pfCancel').hidden = true;
    updatePricePreview();
  }

  function updatePricePreview() {
    const raw = $('#pfPrice').value;
    const cents = parseEuro(raw);
    $('#pfPricePreview').textContent = raw && Number.isFinite(cents) && cents > 0 ? `= ${euro(cents)}` : '';
  }

  async function submitProduct(e) {
    e.preventDefault();
    const name = $('#pfName').value.trim();
    const price = parseEuro($('#pfPrice').value);
    if (!name) { toast('Bitte einen Namen eingeben.', 'error'); return; }
    if (!Number.isFinite(price) || price < 1 || price > 10000) { toast('Bitte einen Preis eingeben, z. B. 0,50', 'error'); return; }

    let image = null;
    const file = $('#pfImage').files && $('#pfImage').files[0];
    if (file) {
      try {
        image = await compressImage(file);
      } catch (err) {
        toast(err.message, 'error');
        return;
      }
    }

    if (state.editingId) {
      const p = state.products.find(x => x.id === state.editingId);
      if (p) {
        const backup = { ...p };
        p.name = name;
        p.price = price;
        if (image) p.image = image;
        if (!saveProducts()) { Object.assign(p, backup); return; }
        toast(`„${name}“ gespeichert`);
      }
    } else {
      const p = { id: uid('p_'), name, price, image };
      state.products.push(p);
      if (!saveProducts()) { state.products.pop(); return; }
      toast(`„${name}“ hinzugefügt`);
    }
    cancelEdit();
    renderManageList();
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      if (file.size > 15 * 1024 * 1024) { reject(new Error('Das Bild ist zu groß.')); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
        img.onload = () => {
          const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          let q = 0.8;
          let data = canvas.toDataURL('image/jpeg', q);
          while (data.length > 150 * 1024 && q > 0.3) {
            q -= 0.1;
            data = canvas.toDataURL('image/jpeg', q);
          }
          resolve(data);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function resetProducts() {
    const ok = await ask('Standard-Produkte wiederherstellen? Eigene Produkte werden gelöscht.', { icon: '🔄', danger: true, say: false });
    if (!ok) return;
    state.products = DEFAULT_PRODUCTS.map(p => ({ ...p }));
    state.cart.clear();
    saveProducts();
    cancelEdit();
    renderManageList();
    toast('Standard-Produkte wiederhergestellt');
  }

  // ═══════════════════════════════════════════════════════════
  // LEHRERBEREICH: EINKAUF
  // ═══════════════════════════════════════════════════════════
  function renderShopping() {
    if (!state.products.length) {
      $('#shopList').innerHTML = '<li class="empty">Noch keine Produkte.</li>';
    } else {
      $('#shopList').innerHTML = state.products.map(p => {
        const inv = state.inventory[p.id] || { needed: false, qty: 1 };
        return `<li class="shop-item" data-id="${esc(p.id)}">
          <input type="checkbox" ${inv.needed ? 'checked' : ''} aria-label="${esc(p.name)} kaufen">
          <img src="${esc(productImage(p))}" alt="">
          <strong>${esc(p.name)}</strong>
          <div class="shop-qty" ${inv.needed ? '' : 'hidden'}>
            <button class="mini-btn" data-act="minus" aria-label="Weniger">−</button>
            <span>${inv.qty || 1}</span>
            <button class="mini-btn" data-act="plus" aria-label="Mehr">+</button>
          </div>
        </li>`;
      }).join('');
    }
    updateShoppingText();
  }

  function updateShoppingText() {
    const needed = state.products
      .filter(p => state.inventory[p.id] && state.inventory[p.id].needed)
      .map(p => ({ name: p.name, qty: state.inventory[p.id].qty || 1 }));
    $('#shoppingCard').hidden = needed.length === 0;
    if (!needed.length) return;
    const date = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const line = '─'.repeat(32);
    $('#shoppingText').textContent =
`EINKAUFSLISTE – Klassenkiosk
${date}
${line}

${needed.map(i => `☐  ${i.qty} × ${i.name}`).join('\n')}

${line}
${needed.length} ${needed.length === 1 ? 'Produkt' : 'Produkte'} · ${needed.reduce((s, i) => s + i.qty, 0)} Stück`;
  }

  function shoppingChange(id, act, checked) {
    const inv = state.inventory[id] || { needed: false, qty: 1 };
    if (act === 'check') inv.needed = checked;
    if (act === 'plus') inv.qty = (inv.qty || 1) + 1;
    if (act === 'minus') inv.qty = Math.max(1, (inv.qty || 1) - 1);
    state.inventory[id] = inv;
    saveInventory();
    renderShopping();
  }

  // ═══════════════════════════════════════════════════════════
  // LEHRERBEREICH: DATEN
  // ═══════════════════════════════════════════════════════════
  function exportData() {
    const data = {
      app: 'klassenkiosk',
      version: 4,
      exportDate: new Date().toISOString(),
      products: state.products,
      history: state.history,
      inventory: state.inventory,
      settings: state.settings
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `klassenkiosk_sicherung_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Sicherung gespeichert');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (e) {
        toast('Die Datei ist keine gültige Sicherung.', 'error');
        return;
      }
      if (!data || !Array.isArray(data.products)) {
        toast('Die Datei ist keine gültige Sicherung.', 'error');
        return;
      }
      const ok = await ask('Sicherung laden? Die aktuellen Daten werden ersetzt.', { icon: '📥', say: false });
      if (!ok) return;
      state.products = data.products;
      state.history = Array.isArray(data.history) ? data.history : [];
      state.inventory = data.inventory && typeof data.inventory === 'object' ? data.inventory : {};
      if (data.settings && typeof data.settings === 'object') {
        state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
        delete state.settings.soundEnabled;
      }
      state.cart.clear();
      saveProducts(); saveHistory(); saveInventory(); saveSettings();
      applySettings();
      showTab(state.tab);
      toast('Sicherung geladen');
    };
    reader.readAsText(file);
  }

  async function clearHistory() {
    const ok = await ask('Den ganzen Verlauf löschen? Das kann man nicht rückgängig machen.', { icon: '⚠️', danger: true, say: false });
    if (!ok) return;
    state.history = [];
    saveHistory();
    toast('Verlauf gelöscht');
  }

  // ═══════════════════════════════════════════════════════════
  // EREIGNISSE
  // ═══════════════════════════════════════════════════════════
  function bindEvents() {
    // Kaputte Bilder → Platzhalter
    document.addEventListener('error', e => {
      const img = e.target;
      if (img && img.tagName === 'IMG' && !img.dataset.fallback) {
        img.dataset.fallback = '1';
        img.src = placeholderImage(img.alt || '?');
      }
    }, true);

    // Kopfzeile
    $('#speechToggle').addEventListener('click', () => {
      const on = !state.settings.speech;
      setSetting('speech', on);
      if (on) speak('Vorlesen ist an.');
      else if ('speechSynthesis' in window) speechSynthesis.cancel();
    });
    $('#teacherBtn').addEventListener('click', () => {
      if ($('#app').dataset.screen === 'teacher') showScreen('sell');
      else openTeacher();
    });

    $$('[data-speak-hint]').forEach(btn => btn.addEventListener('click', () => {
      speak(hintSpeech(Number(btn.dataset.speakHint)), true);
    }));

    // Schritt 1
    $('#productsGrid').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.closest('.product').dataset.id;
      if (btn.dataset.action === 'add') addToCart(id);
      else removeFromCart(id);
    });
    $('#clearCartBtn').addEventListener('click', clearCart);
    $('#toPayBtn').addEventListener('click', () => { state._wasEnough = false; goStep(2); });

    // Schritt 2
    $('#moneyPad').addEventListener('click', e => {
      const btn = e.target.closest('.money-btn');
      if (btn) addMoney(Number(btn.dataset.value));
    });
    $('#givenTray').addEventListener('click', e => {
      const btn = e.target.closest('.tray-money');
      if (btn) removeMoney(Number(btn.dataset.index));
    });
    $('#numKeys').addEventListener('click', e => {
      const btn = e.target.closest('.num-key');
      if (btn) keypadPress(btn.dataset.key);
    });
    $('#undoMoneyBtn').addEventListener('click', () => removeMoney(state.given.length - 1));
    $('#exactBtn').addEventListener('click', payExact);
    $('#toChangeBtn').addEventListener('click', () => goStep(3));

    // Schritt 3
    $('#changeMoney').addEventListener('click', e => {
      const btn = e.target.closest('.change-piece');
      if (btn) toggleChangePiece(Number(btn.dataset.index));
    });
    $('#finishBtn').addEventListener('click', finishSale);

    $$('[data-go-step]').forEach(btn => btn.addEventListener('click', () => goStep(Number(btn.dataset.goStep))));

    // Feier antippen = schließen
    $('#celebrate').addEventListener('click', () => { $('#celebrate').hidden = true; });

    // Tastatur (z. B. Tablet mit Tastatur oder Hilfsmittel)
    document.addEventListener('keydown', e => {
      if ($('#app').dataset.screen !== 'sell' || document.querySelector('dialog[open]')) return;
      if (state.step === 2 && state.settings.payMode === 'keypad') {
        if (/^[0-9]$/.test(e.key)) keypadPress(e.key);
        else if (e.key === ',' || e.key === '.') keypadPress(',');
        else if (e.key === 'Backspace') keypadPress('⌫');
      }
    });

    // PIN
    const pinKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    $('#pinKeys').innerHTML = pinKeys.map(k => k
      ? `<button class="num-key" data-key="${k}" aria-label="${k === '⌫' ? 'Löschen' : k}">${k}</button>`
      : '<span></span>').join('');
    $('#pinKeys').addEventListener('click', e => {
      const btn = e.target.closest('.num-key');
      if (btn) pinPress(btn.dataset.key);
    });
    $('#pinDialog').addEventListener('keydown', e => {
      if (/^[0-9]$/.test(e.key)) pinPress(e.key);
      if (e.key === 'Backspace') pinPress('⌫');
    });
    $('#pinCancel').addEventListener('click', () => $('#pinDialog').close());

    // Lehrerbereich
    $$('.teacher-tabs .tab[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('#exitTeacherBtn').addEventListener('click', () => showScreen('sell'));

    $$('[data-period]').forEach(b => b.addEventListener('click', () => {
      state.chartDays = Number(b.dataset.period);
      $$('[data-period]').forEach(x => x.classList.toggle('active', x === b));
      renderChart();
    }));

    $('#historyFilter').addEventListener('click', e => {
      const b = e.target.closest('.seg');
      if (!b) return;
      state.historyFilter = b.dataset.filter;
      renderHistory();
    });
    $('#historyList').addEventListener('click', e => {
      const b = e.target.closest('.history-del');
      if (b) deleteTransaction(b.dataset.id);
    });

    $('#productForm').addEventListener('submit', submitProduct);
    $('#pfCancel').addEventListener('click', cancelEdit);
    $('#pfPrice').addEventListener('input', updatePricePreview);
    $('#manageList').addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b) manageAction(b.closest('.manage-item').dataset.id, b.dataset.act);
    });

    $('#shopList').addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b) shoppingChange(b.closest('.shop-item').dataset.id, b.dataset.act);
    });
    $('#shopList').addEventListener('change', e => {
      if (e.target.type === 'checkbox') shoppingChange(e.target.closest('.shop-item').dataset.id, 'check', e.target.checked);
    });
    $('#clearShoppingBtn').addEventListener('click', () => {
      state.inventory = {};
      saveInventory();
      renderShopping();
    });
    $('#copyShoppingBtn').addEventListener('click', () => {
      const text = $('#shoppingText').textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => toast('Liste kopiert')).catch(() => toast('Kopieren hat nicht geklappt', 'error'));
      }
    });
    $('#printShoppingBtn').addEventListener('click', () => {
      document.body.classList.add('print-shopping');
      window.print();
      setTimeout(() => document.body.classList.remove('print-shopping'), 500);
    });

    // Einstellungen
    $$('[data-setting]').forEach(input => input.addEventListener('change', () => {
      setSetting(input.dataset.setting, input.checked);
    }));
    $$('[data-setting-choice]').forEach(group => group.addEventListener('click', e => {
      const b = e.target.closest('.seg');
      if (!b) return;
      setSetting(group.dataset.settingChoice, b.dataset.value);
      if (group.dataset.settingChoice === 'speechRate') speak('So schnell lese ich vor.', true);
    }));
    $('#pinForm').addEventListener('submit', e => {
      e.preventDefault();
      const pin = $('#newPin').value.trim();
      if (!/^\d{4}$/.test(pin)) { toast('Die PIN muss 4 Ziffern haben.', 'error'); return; }
      state.settings.pin = pin;
      saveSettings();
      $('#newPin').value = '';
      toast('Neue PIN gespeichert');
    });

    $('#exportBtn').addEventListener('click', exportData);
    $('#importFile').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) importData(file);
      e.target.value = '';
    });
    $('#resetProductsBtn').addEventListener('click', resetProducts);
    $('#clearHistoryBtn').addEventListener('click', clearHistory);
  }

  // ═══════════════════════════════════════════════════════════
  // START
  // ═══════════════════════════════════════════════════════════
  function init() {
    loadAll();
    applySettings();
    if ('speechSynthesis' in window) {
      pickVoice();
      speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', pickVoice);
    }
    bindEvents();
    renderMoneyPad();
    showScreen('sell');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
