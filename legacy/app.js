const products = [
  { name: "Органайзер Loft Box", market: "WB", group: "home", sales: 182, revenue: 1248000, profit: 334000, costs: 321000, margin: 26.8, status: "Здоровый рост" },
  { name: "Сыворотка Glow C", market: "Ozon", group: "beauty", sales: 96, revenue: 792000, profit: 162000, costs: 244000, margin: 20.5, status: "Контроль ДРР" },
  { name: "Набор полотенец Soft", market: "WB", group: "home", sales: 134, revenue: 651000, profit: 121000, costs: 173000, margin: 18.6, status: "Проверить логистику" },
  { name: "Детский термостакан", market: "Ozon", group: "kids", sales: 77, revenue: 438000, profit: 103000, costs: 112000, margin: 23.5, status: "Здоровый рост" },
  { name: "Массажная щетка", market: "WB", group: "beauty", sales: 62, revenue: 302000, profit: 31000, costs: 119000, margin: 10.3, status: "Низкая маржа" }
];

const chartSeries = [
  { revenue: 44, profit: 18 },
  { revenue: 52, profit: 22 },
  { revenue: 49, profit: 19 },
  { revenue: 63, profit: 27 },
  { revenue: 58, profit: 24 },
  { revenue: 74, profit: 36 },
  { revenue: 69, profit: 31 },
  { revenue: 82, profit: 38 },
  { revenue: 79, profit: 35 },
  { revenue: 91, profit: 43 },
  { revenue: 86, profit: 41 },
  { revenue: 96, profit: 47 }
];

const alerts = [
  { icon: "₽", title: "Комиссия WB выросла", text: "По двум позициям комиссия выше средней на 4.8 п.п. Проверьте категорию и тариф хранения." },
  { icon: "%", title: "ДРР близок к лимиту", text: "Реклама сыворотки Glow C дает продажи, но съедает 18% выручки за период." },
  { icon: "↻", title: "Остатки на 9 дней", text: "Органайзер Loft Box может уйти в out of stock при текущем темпе продаж." }
];

const defaultExpenses = [
  { id: "exp-001", name: "Закупка", value: 34, amount: 744000 },
  { id: "exp-002", name: "Логистика", value: 21, amount: 459000 },
  { id: "exp-003", name: "Комиссии", value: 18, amount: 394000 },
  { id: "exp-004", name: "Реклама", value: 16, amount: 351000 },
  { id: "exp-005", name: "Хранение и возвраты", value: 11, amount: 241000 }
];

const ads = [
  { name: "Glow C поиск", market: "Ozon", spend: 142000, sales: 792000, drr: 17.9, status: "Контроль" },
  { name: "Loft Box каталог", market: "WB", spend: 96000, sales: 1248000, drr: 7.7, status: "Ок" },
  { name: "Полотенца ретаргет", market: "WB", spend: 68000, sales: 651000, drr: 10.4, status: "Ок" },
  { name: "Термостакан карточка", market: "Ozon", spend: 45000, sales: 438000, drr: 10.3, status: "Ок" }
];

const stock = [
  { name: "Органайзер Loft Box", market: "WB", quantity: 164, days: 9, supply: "Нужна поставка" },
  { name: "Сыворотка Glow C", market: "Ozon", quantity: 88, days: 18, supply: "Норма" },
  { name: "Набор полотенец Soft", market: "WB", quantity: 57, days: 12, supply: "Планировать" },
  { name: "Детский термостакан", market: "Ozon", quantity: 124, days: 31, supply: "Норма" },
  { name: "Массажная щетка", market: "WB", quantity: 42, days: 20, supply: "Снизить закуп" }
];

const storageKey = "sallerfix.settings";
const operationsStorageKey = "sallerfix.operations";
const expensesStorageKey = "sallerfix.expenses";
const filtersStorageKey = "sallerfix.filters";
let expenses = [];

const defaultOperations = [
  { id: "op-001", date: "2026-05-01", market: "WB", category: "Продажа", sku: "Органайзер Loft Box", amount: 1248000, type: "income" },
  { id: "op-002", date: "2026-05-01", market: "WB", category: "Комиссия", sku: "Органайзер Loft Box", amount: -143000, type: "expense" },
  { id: "op-003", date: "2026-05-02", market: "Ozon", category: "Продажа", sku: "Сыворотка Glow C", amount: 792000, type: "income" },
  { id: "op-004", date: "2026-05-02", market: "Ozon", category: "Реклама", sku: "Сыворотка Glow C", amount: -142000, type: "expense" },
  { id: "op-005", date: "2026-05-03", market: "WB", category: "Логистика", sku: "Набор полотенец Soft", amount: -81000, type: "expense" },
  { id: "op-006", date: "2026-05-04", market: "Ozon", category: "Выплата", sku: "Детский термостакан", amount: 214000, type: "income" }
];

const API_BASE = "http://localhost:4000/api";

async function fetchApi(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

window.dashboardAPI = {
  async getProfitByPeriod({ date_from = "", date_to = "" } = {}) {
    try {
      const params = new URLSearchParams();
      if (date_from) params.set("from", date_from);
      if (date_to) params.set("to", date_to);
      const data = await fetchApi(`/dashboard/summary?${params.toString()}`);
      return { date_from: date_from || null, date_to: date_to || null, profit: data.summary.profit };
    } catch {
      return { date_from: date_from || null, date_to: date_to || null, profit: 0 };
    }
  },
  async getProfitBySku({ date_from = "", date_to = "" } = {}) {
    try {
      const params = new URLSearchParams();
      if (date_from) params.set("from", date_from);
      if (date_to) params.set("to", date_to);
      const data = await fetchApi(`/dashboard/summary?${params.toString()}`);
      return data.by_sku;
    } catch {
      return [];
    }
  },
  async getTopLossSku({ limit = 5, date_from = "", date_to = "" } = {}) {
    const rows = await window.dashboardAPI.getProfitBySku({ date_from, date_to });
    return rows.sort((a, b) => a.profit - b.profit).slice(0, Math.max(1, limit));
  },
  async getActiveAlerts() {
    try {
      return await fetchApi("/alerts");
    } catch {
      return [];
    }
  },
  async getProfitLeaks() {
    try {
      return await fetchApi("/profit-leaks");
    } catch {
      return [];
    }
  }
};

const formatRub = (value) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value);

const state = {
  period: "30",
  market: "all",
  group: "all",
  operationMarket: "all",
  operationType: "all",
  operationSearch: "",
  operationCategory: "all",
  reportMarket: "all",
  reportPeriodDays: "all",
  alertFeed: [],
  activeModal: null,
  costImportRows: 0
};

const defaultFilterState = {
  period: "30",
  market: "all",
  group: "all",
  operationMarket: "all",
  operationType: "all",
  operationSearch: "",
  operationCategory: "all",
  reportMarket: "all",
  reportPeriodDays: "all"
};

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function saveSettingsToStorage(settings) {
  const safeSettings = {
    returnsRule: settings.returnsRule,
    adsRule: settings.adsRule,
    stockRule: settings.stockRule
  };
  localStorage.setItem(storageKey, JSON.stringify(safeSettings));
}

function loadFiltersFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(filtersStorageKey)) || {};
    return saved;
  } catch {
    return {};
  }
}

function saveFiltersToStorage() {
  const snapshot = {
    period: state.period,
    market: state.market,
    group: state.group,
    operationMarket: state.operationMarket,
    operationType: state.operationType,
    operationSearch: state.operationSearch,
    operationCategory: state.operationCategory,
    reportMarket: state.reportMarket,
    reportPeriodDays: state.reportPeriodDays
  };
  localStorage.setItem(filtersStorageKey, JSON.stringify(snapshot));
}

function applyFilterStateToControls() {
  document.querySelector("#periodFilter").value = state.period;
  document.querySelector("#marketFilter").value = state.market;
  document.querySelector("#groupFilter").value = state.group;
  document.querySelector("#operationMarketFilter").value = state.operationMarket;
  document.querySelector("#operationTypeFilter").value = state.operationType;
  document.querySelector("#operationSearch").value = state.operationSearch;
  document.querySelector("#reportMarketFilter").value = state.reportMarket;
  document.querySelector("#reportPeriodFilter").value = state.reportPeriodDays;
}

function restoreFilters() {
  const saved = loadFiltersFromStorage();
  const next = {
    period: ["30", "14", "7"].includes(saved.period) ? saved.period : defaultFilterState.period,
    market: ["all", "WB", "Ozon"].includes(saved.market) ? saved.market : defaultFilterState.market,
    group: ["all", "home", "beauty", "kids"].includes(saved.group) ? saved.group : defaultFilterState.group,
    operationMarket: ["all", "WB", "Ozon"].includes(saved.operationMarket) ? saved.operationMarket : defaultFilterState.operationMarket,
    operationType: ["all", "income", "expense"].includes(saved.operationType) ? saved.operationType : defaultFilterState.operationType,
    operationSearch: typeof saved.operationSearch === "string" ? saved.operationSearch : defaultFilterState.operationSearch,
    operationCategory: ["all", "sale", "commission", "logistics", "ads", "other"].includes(saved.operationCategory)
      ? saved.operationCategory
      : defaultFilterState.operationCategory,
    reportMarket: ["all", "WB", "Ozon"].includes(saved.reportMarket) ? saved.reportMarket : defaultFilterState.reportMarket,
    reportPeriodDays: ["all", "7", "14", "30"].includes(saved.reportPeriodDays) ? saved.reportPeriodDays : defaultFilterState.reportPeriodDays
  };
  Object.assign(state, next);
  applyFilterStateToControls();
}

function resetFilters() {
  Object.assign(state, defaultFilterState);
  applyFilterStateToControls();
  saveFiltersToStorage();
  render();
  showToast("Фильтры сброшены", "good");
}

function makeOperationId() {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeExpenseId() {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeOperations(rows) {
  return rows.map((row) => ({
    ...row,
    id: row.id || makeOperationId(),
    amount: Number(row.amount)
  }));
}

function getOperations() {
  try {
    const data = JSON.parse(localStorage.getItem(operationsStorageKey));
    if (!data) return defaultOperations;
    const normalized = normalizeOperations(data);
    if (normalized.some((row, index) => row.id !== data[index]?.id || row.amount !== data[index]?.amount)) {
      saveOperations(normalized);
    }
    return normalized;
  } catch {
    return defaultOperations;
  }
}

function saveOperations(rows) {
  localStorage.setItem(operationsStorageKey, JSON.stringify(rows));
}

function normalizeExpenses(rows) {
  return rows
    .map((row) => ({
      id: String(row.id || makeExpenseId()),
      name: String(row.name || "").trim(),
      amount: Math.abs(Number(row.amount)),
      value: Number(row.value)
    }))
    .filter((row) => row.name && Number.isFinite(row.amount) && row.amount > 0);
}

function getExpenses() {
  try {
    const data = JSON.parse(localStorage.getItem(expensesStorageKey));
    if (!data) return defaultExpenses;
    const normalized = normalizeExpenses(data);
    if (normalized.length !== data.length) saveExpenses(normalized);
    return normalized;
  } catch {
    return defaultExpenses;
  }
}

function saveExpenses(rows) {
  expenses = normalizeExpenses(rows);
  localStorage.setItem(expensesStorageKey, JSON.stringify(expenses));
}

function sumOperations(operations, matcher) {
  return operations.filter(matcher).reduce((sum, row) => sum + Math.abs(row.amount), 0);
}

function categoryIncludes(row, words) {
  const category = row.category.toLowerCase();
  return words.some((word) => category.includes(word));
}

function getPnlModel() {
  const operations = getOperations();
  const sales = sumOperations(operations, (row) => row.amount > 0 && categoryIncludes(row, ["продаж", "начислен"]));
  const returns = sumOperations(operations, (row) => row.amount < 0 && categoryIncludes(row, ["возврат", "отмен"]));
  const cogs = sumOperations(operations, (row) => row.amount < 0 && categoryIncludes(row, ["себесто", "закуп"]));
  const commissions = sumOperations(operations, (row) => row.amount < 0 && categoryIncludes(row, ["комисс"]));
  const logistics = sumOperations(operations, (row) => row.amount < 0 && categoryIncludes(row, ["логист", "достав"]));
  const storage = sumOperations(operations, (row) => row.amount < 0 && categoryIncludes(row, ["хран", "прием", "приём"]));
  const adsCost = sumOperations(operations, (row) => row.amount < 0 && categoryIncludes(row, ["реклам", "продвиж"]));
  const knownExpense = returns + cogs + commissions + logistics + storage + adsCost;
  const otherExpenses = Math.max(0, sumOperations(operations, (row) => row.amount < 0) - knownExpense);
  const manualExpenses = getExpenses().reduce((sum, item) => sum + item.amount, 0);
  const netRevenue = sales - returns;
  const grossProfit = netRevenue - cogs - commissions - logistics - storage;
  const operatingExpenses = adsCost + otherExpenses + manualExpenses;
  const ebitda = grossProfit - operatingExpenses;

  return {
    rows: [
      { label: "Выручка", value: sales, section: "Доходы" },
      { label: "Возвраты и отмены", value: -returns },
      { label: "Чистая выручка", value: netRevenue },
      { label: "Себестоимость", value: -cogs, section: "Переменные расходы" },
      { label: "Комиссии маркетплейсов", value: -commissions },
      { label: "Логистика", value: -logistics },
      { label: "Хранение и приемка", value: -storage },
      { label: "Валовая прибыль", value: grossProfit },
      { label: "Реклама", value: -adsCost, section: "Операционные расходы" },
      { label: "Ручные расходы", value: -manualExpenses },
      { label: "Прочие расходы", value: -otherExpenses },
      { label: "EBITDA", value: ebitda }
    ],
    sales,
    grossProfit,
    operatingExpenses,
    ebitda
  };
}

function getSkuAnalytics() {
  const grouped = new Map();
  getOperations().forEach((row) => {
    const sku = row.sku || "Без SKU";
    const current = grouped.get(sku) || {
      name: sku,
      market: row.market,
      revenue: 0,
      costs: 0,
      profit: 0,
      operations: 0
    };
    if (row.amount > 0) current.revenue += row.amount;
    if (row.amount < 0) current.costs += Math.abs(row.amount);
    current.profit += row.amount;
    current.operations += 1;
    current.market = current.market === row.market ? current.market : "mix";
    grouped.set(sku, current);
  });

  return [...grouped.values()].map((item) => ({
    ...item,
    margin: item.revenue ? Math.round((item.profit / item.revenue) * 1000) / 10 : 0,
    status: item.profit < 0 ? "Убыточный" : item.margin < 15 ? "Низкая маржа" : "Здоровый рост"
  }));
}

const getFilteredProducts = () =>
  products.filter((product) => {
    const matchesMarket = state.market === "all" || product.market === state.market;
    const matchesGroup = state.group === "all" || product.group === state.group;
    return matchesMarket && matchesGroup;
  });

function renderMetrics(rows) {
  const multiplier = Number(state.period) / 30;
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0) * multiplier;
  const profit = rows.reduce((sum, row) => sum + row.profit, 0) * multiplier;
  const costs = rows.reduce((sum, row) => sum + row.costs, 0) * multiplier;
  const adSpend = costs * 0.22;
  const roi = adSpend ? Math.round((profit / adSpend) * 100) : 0;

  document.querySelector("#revenueMetric").textContent = formatRub(revenue);
  document.querySelector("#profitMetric").textContent = formatRub(profit);
  document.querySelector("#costMetric").textContent = formatRub(costs);
  document.querySelector("#roiMetric").textContent = `${roi}%`;
}

function renderChart() {
  const chart = document.querySelector("#profitChart");
  const periodFactor = Number(state.period) / 30;
  chart.innerHTML = chartSeries
    .map((point) => {
      const revenueHeight = Math.max(8, point.revenue * periodFactor);
      const profitHeight = Math.max(8, point.profit * periodFactor * 1.45);
      return `
        <div class="bar-group">
          <span class="bar revenue" style="height:${revenueHeight}%"></span>
          <span class="bar profit" style="height:${profitHeight}%"></span>
        </div>
      `;
    })
    .join("");
}

function renderProducts(rows) {
  const table = document.querySelector("#productTable");
  table.innerHTML = rows
    .map((product) => {
      const statusClass =
        product.margin < 14 ? "danger" : product.status.includes("Проверить") || product.status.includes("Контроль") ? "warning" : "";
      return `
        <tr>
          <td><strong>${product.name}</strong></td>
          <td>${product.market}</td>
          <td>${product.sales} шт.</td>
          <td>${product.margin}%</td>
          <td><span class="tag ${statusClass}">${product.status}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderAlerts() {
  const dynamicAlerts = state.alertFeed.slice(0, 3).map((item) => ({
    icon: item.rule.includes("ДРР") ? "%" : item.rule.includes("out-of-stock") ? "!" : "₽",
    title: `${item.rule}: ${item.sku}`,
    text: `Площадка: ${item.market}. Значение: ${item.value}`
  }));
  const sourceAlerts = dynamicAlerts.length ? dynamicAlerts : alerts;
  const alertList = document.querySelector("#alertList");
  alertList.innerHTML = sourceAlerts
    .map(
      (alert) => `
        <div class="alert-item">
          <span class="alert-badge">${alert.icon}</span>
          <div>
            <strong>${alert.title}</strong>
            <span>${alert.text}</span>
          </div>
        </div>
      `
    )
    .join("");
}

async function refreshAlertFeed() {
  const data = await window.dashboardAPI.getActiveAlerts();
  if (!Array.isArray(data)) return;
  state.alertFeed = data.map((item) => ({
    rule: item.rule || item.rule_type || "Алерт",
    sku: item.sku || "SKU",
    market: item.market || "-",
    value: item.value || 0
  }));
  renderAlerts();
}

function renderProfitLeaks(rows) {
  const list = document.querySelector("#profitLeakList");
  if (!list) return;
  const top = rows.slice(0, 5);
  if (!top.length) {
    list.innerHTML = `
      <div class="alert-item">
        <span class="alert-badge">i</span>
        <div>
          <strong>Нет данных по утечкам</strong>
          <span>Запусти backend для аналитики decision engine.</span>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = top
    .map((row) => {
      const icon = row.severity === "critical" ? "!" : row.severity === "warning" ? "%" : "+";
      return `
        <div class="alert-item">
          <span class="alert-badge">${icon}</span>
          <div>
            <strong>${row.sku} · ${row.reason}</strong>
            <span>${row.recommended_action} · ${formatRub(-Math.abs(row.loss_amount))}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

async function refreshProfitLeaks() {
  const rows = await window.dashboardAPI.getProfitLeaks();
  if (!Array.isArray(rows)) return;
  renderProfitLeaks(rows);
}

function renderExpenses() {
  expenses = getExpenses();
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0) || 1;
  const compactMarkup = expenses
    .map(
      (expense) => `
        <div class="expense-row">
          <div class="expense-top">
            <strong>${expense.name}</strong>
            <span>${formatRub(expense.amount)} · ${Math.round((expense.amount / total) * 100)}%</span>
          </div>
          <div class="expense-bar"><i style="width:${Math.max(4, Math.round((expense.amount / total) * 100))}%"></i></div>
        </div>
      `
    )
    .join("");
  const detailedMarkup = expenses
    .map(
      (expense) => `
        <div class="expense-row">
          <div class="expense-top">
            <strong>${expense.name}</strong>
            <span>${formatRub(expense.amount)} · ${Math.round((expense.amount / total) * 100)}%</span>
          </div>
          <div class="expense-bar"><i style="width:${Math.max(4, Math.round((expense.amount / total) * 100))}%"></i></div>
          <div class="expense-actions">
            <button class="ghost-button compact" data-edit-expense="${expense.id}" type="button">Изменить</button>
            <button class="ghost-button compact danger-button" data-delete-expense="${expense.id}" type="button">Удалить</button>
          </div>
        </div>
      `
    )
    .join("");
  document.querySelector("#expenseStack").innerHTML = compactMarkup;
  document.querySelector("#expenseDetailStack").innerHTML = detailedMarkup;
}

function renderPnl() {
  const model = getPnlModel();
  const table = document.querySelector("#pnlTable");
  table.innerHTML = model.rows
    .map((row) => {
      const section = row.section ? `<tr class="section-row"><td colspan="2">${row.section}</td></tr>` : "";
      const tone = row.value < 0 ? "bad" : row.label.includes("прибыль") || row.label.includes("выручка") || row.label.includes("EBITDA") ? "good" : "";
      return `
        ${section}
        <tr>
          <td>${row.label}</td>
          <td class="${tone}">${formatRub(row.value)}</td>
        </tr>
      `;
    })
    .join("");

  const grossMargin = model.sales ? Math.round((model.grossProfit / model.sales) * 1000) / 10 : 0;
  const ebitdaMargin = model.sales ? Math.round((model.ebitda / model.sales) * 1000) / 10 : 0;
  document.querySelector("#grossProfitMetric").textContent = formatRub(model.grossProfit);
  document.querySelector("#operatingExpenseMetric").textContent = formatRub(model.operatingExpenses);
  document.querySelector("#ebitdaMetric").textContent = formatRub(model.ebitda);
  document.querySelector("#grossProfitNote").textContent = `${grossMargin}% от выручки`;
  document.querySelector("#ebitdaNote").textContent = `${ebitdaMargin}% маржа`;
}

function renderCashflow() {
  const operations = getOperations();
  const balance = operations.reduce((sum, row) => sum + row.amount, 0);
  const markup = operations
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
    .map(
      (item) => `
        <div class="timeline-item">
          <span class="timeline-date">${item.date}</span>
          <div>
            <strong>${item.category} · ${item.market}</strong>
            <span>${item.sku}</span>
          </div>
          <span class="timeline-amount ${item.amount > 0 ? "good" : "bad"}">${formatRub(item.amount)}</span>
        </div>
      `
    )
    .join("");
  document.querySelector("#cashflowTimeline").innerHTML = markup;
  document.querySelector("#paymentModalTimeline").innerHTML = markup;
  document.querySelector("#cashAvailableMetric").textContent = formatRub(balance);
  document.querySelector("#cashAvailableMetric").className = balance >= 0 ? "good" : "bad";
  document.querySelector("#cashStatusNote").textContent = balance >= 0 ? "Разрыва не ожидается" : "Есть риск кассового разрыва";
  document.querySelector("#cashStatusNote").className = balance >= 0 ? "good" : "bad";
}

function renderMarketCards(market, target) {
  const rows = getSkuAnalytics().filter((product) => product.market === market);
  document.querySelector(target).innerHTML = rows
    .map(
      (product) => `
        <article class="market-card">
          <h3>${product.name}</h3>
          <dl>
            <div><dt>Выручка</dt><dd>${formatRub(product.revenue)}</dd></div>
            <div><dt>Прибыль</dt><dd>${formatRub(product.profit)}</dd></div>
            <div><dt>Расходы</dt><dd>${formatRub(product.costs)}</dd></div>
            <div><dt>Маржа</dt><dd>${product.margin}%</dd></div>
          </dl>
          <span class="tag ${product.margin < 14 ? "danger" : product.status.includes("Контроль") ? "warning" : ""}">${product.status}</span>
        </article>
      `
    )
    .join("");
}

function renderAds() {
  document.querySelector("#adsTable").innerHTML = ads
    .map(
      (campaign) => `
        <tr>
          <td><strong>${campaign.name}</strong></td>
          <td>${campaign.market}</td>
          <td>${formatRub(campaign.spend)}</td>
          <td>${formatRub(campaign.sales)}</td>
          <td>${campaign.drr}%</td>
          <td><span class="tag ${campaign.status === "Контроль" ? "warning" : ""}">${campaign.status}</span></td>
        </tr>
      `
    )
    .join("");
}

function renderStock() {
  const markup = stock
    .map(
      (item) => `
        <article class="stock-card">
          <h3>${item.name}</h3>
          <span class="stock-days ${item.days <= 12 ? "low" : ""}">${item.days} дней остатка</span>
          <dl>
            <div><dt>Площадка</dt><dd>${item.market}</dd></div>
            <div><dt>На складе</dt><dd>${item.quantity} шт.</dd></div>
            <div><dt>Действие</dt><dd>${item.supply}</dd></div>
          </dl>
        </article>
      `
    )
    .join("");
  document.querySelector("#stockCards").innerHTML = markup;
  document.querySelector("#supplyModalCards").innerHTML = stock
    .filter((item) => item.days <= 12)
    .map(
      (item) => `
        <article class="stock-card">
          <h3>${item.name}</h3>
          <span class="stock-days low">${item.days} дней остатка</span>
          <dl>
            <div><dt>Площадка</dt><dd>${item.market}</dd></div>
            <div><dt>Рекомендация</dt><dd>${item.supply}</dd></div>
          </dl>
        </article>
      `
    )
    .join("");
}

function renderProductFullTable() {
  const rows = getSkuAnalytics();
  const profitable = rows.filter((row) => row.profit > 0).length;
  const loss = rows.filter((row) => row.profit < 0).length;
  const avgMargin = rows.length ? Math.round((rows.reduce((sum, row) => sum + row.margin, 0) / rows.length) * 10) / 10 : 0;

  document.querySelector("#profitableSkuMetric").textContent = profitable;
  document.querySelector("#lossSkuMetric").textContent = loss;
  document.querySelector("#avgSkuMarginMetric").textContent = `${avgMargin}%`;

  document.querySelector("#productFullTable").innerHTML = rows
    .map((product) => {
      const statusClass =
        product.margin < 14 ? "danger" : product.status.includes("Проверить") || product.status.includes("Контроль") ? "warning" : "";
      return `
        <tr>
          <td><strong>${product.name}</strong></td>
          <td>${product.market}</td>
          <td>${formatRub(product.revenue)}</td>
          <td>${formatRub(product.profit)}</td>
          <td>${formatRub(product.costs)}</td>
          <td>${product.margin}%</td>
          <td><span class="tag ${statusClass}">${product.status}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderOperations() {
  const categoryMatchers = {
    sale: ["продаж", "выплат", "начислен"],
    commission: ["комисс"],
    logistics: ["логист", "достав"],
    ads: ["реклам", "продвиж"]
  };

  const operations = getOperations().filter((row) => {
    const matchesMarket = state.operationMarket === "all" || row.market === state.operationMarket;
    const matchesType = state.operationType === "all" || row.type === state.operationType;
    const matchesSearch = !state.operationSearch || row.sku.toLowerCase().includes(state.operationSearch.toLowerCase());
    const activeCategory = state.operationCategory;
    const keywords = categoryMatchers[activeCategory];
    const inKnownCategory = Object.values(categoryMatchers).some((words) => categoryIncludes(row, words));
    const matchesCategory =
      activeCategory === "all"
        ? true
        : activeCategory === "other"
          ? !inKnownCategory
          : categoryIncludes(row, keywords || []);
    return matchesMarket && matchesType && matchesSearch && matchesCategory;
  });
  const allOperations = getOperations();
  const income = operations.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
  const expense = operations.filter((row) => row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const balance = income - expense;

  document.querySelector("#operationIncome").textContent = formatRub(income);
  document.querySelector("#operationExpense").textContent = formatRub(expense);
  document.querySelector("#operationBalance").textContent = formatRub(balance);
  document.querySelector("#operationBalance").className = balance >= 0 ? "good" : "bad";
  document.querySelector("#operationBalanceTone").className = balance >= 0 ? "good" : "bad";
  document.querySelector("#operationsCount").textContent = allOperations.length;

  document.querySelector("#operationsTable").innerHTML = operations
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(
      (row) => `
        <tr>
          <td><input class="operation-select" data-operation-id="${row.id}" type="checkbox" aria-label="Выбрать операцию" /></td>
          <td>${row.date}</td>
          <td>${row.market}</td>
          <td>${row.category}</td>
          <td>${row.sku}</td>
          <td class="${row.amount >= 0 ? "good" : "bad"}">${formatRub(row.amount)}</td>
          <td><span class="tag ${row.amount < 0 ? "warning" : ""}">${row.type === "income" ? "Приход" : "Расход"}</span></td>
          <td><button class="ghost-button compact" data-edit-operation="${row.id}" type="button">Изменить</button></td>
          <td><button class="ghost-button compact danger-button" data-delete-operation="${row.id}" type="button">Удалить</button></td>
        </tr>
      `
    )
    .join("");
  document.querySelector("#operationsSelectAll").checked = false;
  document.querySelectorAll("#operationCategoryFilters [data-operation-category]").forEach((button) => {
    button.classList.toggle("active", button.dataset.operationCategory === state.operationCategory);
  });
}

function getFilteredReportOperations() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Number(state.reportPeriodDays);

  return getOperations().filter((row) => {
    const matchesMarket = state.reportMarket === "all" || row.market === state.reportMarket;
    if (!Number.isFinite(days)) return matchesMarket;
    const rowDate = new Date(row.date);
    rowDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((now - rowDate) / (1000 * 60 * 60 * 24));
    return matchesMarket && diffDays >= 0 && diffDays < days;
  });
}

function getDailyReportRows() {
  const grouped = new Map();
  getFilteredReportOperations().forEach((row) => {
    const current = grouped.get(row.date) || { date: row.date, income: 0, expense: 0, balance: 0 };
    if (row.amount >= 0) current.income += row.amount;
    if (row.amount < 0) current.expense += Math.abs(row.amount);
    current.balance += row.amount;
    grouped.set(row.date, current);
  });

  return [...grouped.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function getMarketReportRows() {
  const grouped = new Map();
  getFilteredReportOperations().forEach((row) => {
    const current = grouped.get(row.market) || { market: row.market, income: 0, expense: 0, balance: 0 };
    if (row.amount >= 0) current.income += row.amount;
    if (row.amount < 0) current.expense += Math.abs(row.amount);
    current.balance += row.amount;
    grouped.set(row.market, current);
  });

  return [...grouped.values()].sort((a, b) => a.market.localeCompare(b.market));
}

function renderReports() {
  const dailyRows = getDailyReportRows();
  const marketRows = getMarketReportRows();
  const bestDay = dailyRows.length ? dailyRows.reduce((best, row) => (row.balance > best.balance ? row : best), dailyRows[0]) : null;
  const worstDay = dailyRows.length ? dailyRows.reduce((worst, row) => (row.balance < worst.balance ? row : worst), dailyRows[0]) : null;

  document.querySelector("#reportsDaysCount").textContent = `${dailyRows.length} дн`;
  document.querySelector("#reportDaysMetric").textContent = dailyRows.length;
  document.querySelector("#reportBestDayMetric").textContent = bestDay ? bestDay.date : "—";
  document.querySelector("#reportBestDayNote").textContent = bestDay ? formatRub(bestDay.balance) : "Нет данных";
  document.querySelector("#reportBestDayNote").className = bestDay && bestDay.balance >= 0 ? "good" : "bad";
  document.querySelector("#reportWorstDayMetric").textContent = worstDay ? worstDay.date : "—";
  document.querySelector("#reportWorstDayNote").textContent = worstDay ? formatRub(worstDay.balance) : "Нет данных";
  document.querySelector("#reportWorstDayNote").className = worstDay && worstDay.balance >= 0 ? "good" : "bad";

  document.querySelector("#dailyReportTable").innerHTML = dailyRows
    .map(
      (row) => `
        <tr>
          <td>${row.date}</td>
          <td class="good">${formatRub(row.income)}</td>
          <td class="bad">${formatRub(-row.expense)}</td>
          <td class="${row.balance >= 0 ? "good" : "bad"}">${formatRub(row.balance)}</td>
        </tr>
      `
    )
    .join("");

  document.querySelector("#marketReportTable").innerHTML = marketRows
    .map(
      (row) => `
        <tr>
          <td><strong>${row.market}</strong></td>
          <td class="good">${formatRub(row.income)}</td>
          <td class="bad">${formatRub(-row.expense)}</td>
          <td class="${row.balance >= 0 ? "good" : "bad"}">${formatRub(row.balance)}</td>
        </tr>
      `
    )
    .join("");
}

function setActivePage() {
  const route = window.location.hash.replace("#", "") || "dashboard";
  const page = document.querySelector(`[data-page="${route}"]`) ? route : "dashboard";

  document.querySelectorAll(".page").forEach((element) => {
    element.classList.toggle("active", element.dataset.page === page);
  });

  document.querySelectorAll(".nav-item, .rail-item").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${page}`);
  });
}

function renderSettings() {
  const settings = getSettings();
  document.querySelector("#wbToken").value = "";
  document.querySelector("#ozonToken").value = "";
  document.querySelector("#erpToken").value = "";
  document.querySelector("#returnsRule").checked = settings.returnsRule ?? true;
  document.querySelector("#adsRule").checked = settings.adsRule ?? true;
  document.querySelector("#stockRule").checked = settings.stockRule ?? true;

  const connected = [
    ["WB", false],
    ["Ozon", false],
    ["ERP", false]
  ];
  document.querySelector("#settingsSummary").innerHTML = connected
    .map(
      ([name, status]) => `
        <div class="summary-line">
          <span>${name}</span>
          <strong class="${status ? "good" : "warn"}">${status ? "Подключено" : "Нужен токен"}</strong>
        </div>
      `
    )
    .join("");
}

function csvEscape(value) {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportPnlCsv() {
  const model = getPnlModel();
  downloadCsv("sallerfix-pnl.csv", [
    ["Статья", "Сумма"],
    ...model.rows.map((row) => [row.label, row.value])
  ]);
}

function exportProductsCsv() {
  const rows = getSkuAnalytics();
  downloadCsv("sallerfix-sku.csv", [
    ["Товар", "Площадка", "Выручка", "Прибыль", "Расходы", "Маржа", "Статус"],
    ...rows.map((product) => [product.name, product.market, product.revenue, product.profit, product.costs, product.margin, product.status])
  ]);
}

function exportOperationsCsv() {
  downloadCsv("sallerfix-operations.csv", [
    ["Дата", "Площадка", "Статья", "SKU", "Сумма", "Тип"],
    ...getOperations().map((row) => [row.date, row.market, row.category, row.sku, row.amount, row.type])
  ]);
}

function exportReportsCsv() {
  const rows = getDailyReportRows();
  downloadCsv("sallerfix-reports-daily.csv", [
    ["Дата", "Приход", "Расход", "Итог"],
    ...rows.map((row) => [row.date, row.income, -row.expense, row.balance])
  ]);
}

function exportExpensesCsv() {
  const rows = getExpenses();
  downloadCsv("sallerfix-expenses.csv", [
    ["Статья", "Сумма", "Доля, %"],
    ...rows.map((row) => [row.name, row.amount, row.value])
  ]);
}

function parseOperationsCsv(csv) {
  return csv
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .slice(1)
    .map((row) => {
      const [date, market, category, sku, amount, type] = row.split(";").map((cell) => cell.trim());
      return {
        id: makeOperationId(),
        date,
        market,
        category,
        sku,
        amount: Number(amount.replace(",", ".")),
        type: type || (Number(amount) >= 0 ? "income" : "expense")
      };
    })
    .filter((row) => row.date && row.market && row.category && Number.isFinite(row.amount));
}

function openModal(id) {
  state.activeModal = id;
  document.querySelector("#modalBackdrop").classList.add("active");
  document.querySelector("#modalBackdrop").setAttribute("aria-hidden", "false");
  document.querySelectorAll(".modal").forEach((modal) => modal.classList.toggle("active", modal.id === id));
}

function closeModal() {
  state.activeModal = null;
  document.querySelector("#modalBackdrop").classList.remove("active");
  document.querySelector("#modalBackdrop").setAttribute("aria-hidden", "true");
  document.querySelectorAll(".modal").forEach((modal) => modal.classList.remove("active"));
  const operationForm = document.querySelector("#operationAddForm");
  if (operationForm) operationForm.reset();
  const operationId = operationForm?.elements?.id;
  if (operationId) operationId.value = "";
  const operationTitle = document.querySelector("#operationAddModalTitle");
  if (operationTitle) operationTitle.textContent = "Добавить операцию";
  const operationSubmit = document.querySelector("#operationAddSubmit");
  if (operationSubmit) operationSubmit.textContent = "Добавить";
  const expenseForm = document.querySelector("#expenseForm");
  if (expenseForm) expenseForm.reset();
  const expenseId = expenseForm?.elements?.id;
  if (expenseId) expenseId.value = "";
  const expenseTitle = document.querySelector("#expenseModalTitle");
  if (expenseTitle) expenseTitle.textContent = "Добавить расход";
  const expenseSubmit = document.querySelector("#expenseSubmit");
  if (expenseSubmit) expenseSubmit.textContent = "Добавить";
}

function showToast(text, tone = "") {
  const stack = document.querySelector("#toastStack");
  if (!stack) return;
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`.trim();
  toast.textContent = text;
  stack.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 2200);
}

function render() {
  const rows = getFilteredProducts();
  renderMetrics(rows);
  renderChart();
  renderProducts(rows);
  renderAlerts();
  renderExpenses();
  renderPnl();
  renderCashflow();
  renderMarketCards("WB", "#wbCards");
  renderMarketCards("Ozon", "#ozonCards");
  renderAds();
  renderStock();
  renderProductFullTable();
  renderOperations();
  renderReports();
  renderSettings();
  setActivePage();
}

document.querySelector("#periodFilter").addEventListener("change", (event) => {
  state.period = event.target.value;
  saveFiltersToStorage();
  render();
});

document.querySelector("#marketFilter").addEventListener("change", (event) => {
  state.market = event.target.value;
  saveFiltersToStorage();
  render();
});

document.querySelector("#groupFilter").addEventListener("change", (event) => {
  state.group = event.target.value;
  saveFiltersToStorage();
  render();
});

document.querySelector("#operationMarketFilter").addEventListener("change", (event) => {
  state.operationMarket = event.target.value;
  saveFiltersToStorage();
  renderOperations();
});

document.querySelector("#operationTypeFilter").addEventListener("change", (event) => {
  state.operationType = event.target.value;
  saveFiltersToStorage();
  renderOperations();
});

document.querySelector("#operationSearch").addEventListener("input", (event) => {
  state.operationSearch = event.target.value;
  saveFiltersToStorage();
  renderOperations();
});

document.querySelector("#operationCategoryFilters").addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const value = target.dataset.operationCategory;
  if (!value) return;
  state.operationCategory = value;
  saveFiltersToStorage();
  renderOperations();
});

document.querySelector("#reportMarketFilter").addEventListener("change", (event) => {
  state.reportMarket = event.target.value;
  saveFiltersToStorage();
  renderReports();
});

document.querySelector("#reportPeriodFilter").addEventListener("change", (event) => {
  state.reportPeriodDays = event.target.value;
  saveFiltersToStorage();
  renderReports();
});

document.querySelector("#refreshButton").addEventListener("click", () => {
  const button = document.querySelector("#refreshButton");
  button.textContent = "Обновлено";
  render();
  window.setTimeout(() => {
    button.textContent = "Обновить";
  }, 1200);
});

document.querySelector("#resetFiltersButton").addEventListener("click", resetFilters);

document.querySelector("#exportPnlTop").addEventListener("click", exportPnlCsv);
document.querySelector("#exportPnlPage").addEventListener("click", exportPnlCsv);
document.querySelector("#exportSkuCompact").addEventListener("click", exportProductsCsv);
document.querySelector("#exportOperations").addEventListener("click", exportOperationsCsv);
document.querySelector("#exportReports").addEventListener("click", exportReportsCsv);
document.querySelector("#exportExpenses").addEventListener("click", exportExpensesCsv);
document.querySelector("#resetExpenses").addEventListener("click", () => {
  const approved = window.confirm("Сбросить расходы к значениям по умолчанию?");
  if (!approved) return;
  saveExpenses(defaultExpenses);
  render();
  showToast("Расходы сброшены", "warn");
});
document.querySelector("#reconcileAds").addEventListener("click", () => {
  window.location.hash = "ads";
  document.querySelector("#reconcileAds").textContent = "Сверено";
  window.setTimeout(() => {
    document.querySelector("#reconcileAds").textContent = "Сверить расходы";
  }, 1200);
});

document.querySelector("#saveSettings").addEventListener("click", () => {
  const wbToken = document.querySelector("#wbToken").value.trim();
  const ozonToken = document.querySelector("#ozonToken").value.trim();
  const erpToken = document.querySelector("#erpToken").value.trim();
  saveSettingsToStorage({
    returnsRule: document.querySelector("#returnsRule").checked,
    adsRule: document.querySelector("#adsRule").checked,
    stockRule: document.querySelector("#stockRule").checked
  });
  // Tokens are intentionally not persisted in localStorage.
  if (wbToken || ozonToken || erpToken) {
    showToast("Токены не сохраняются в браузере. Используйте backend .env", "warn");
  }
  document.querySelector("#saveSettings").textContent = "Сохранено";
  renderSettings();
  window.setTimeout(() => {
    document.querySelector("#saveSettings").textContent = "Сохранить";
  }, 1200);
});

document.querySelector("#settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("#saveSettings").click();
});

document.querySelectorAll("[data-modal-open]").forEach((button) => {
  button.addEventListener("click", () => openModal(button.dataset.modalOpen));
});

document.querySelectorAll("[data-modal-close]").forEach((button) => {
  button.addEventListener("click", closeModal);
});

document.querySelector("#modalBackdrop").addEventListener("click", (event) => {
  if (event.target.id === "modalBackdrop") closeModal();
});

document.querySelector("#expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const currentId = form.get("id")?.toString() || "";
  const name = form.get("name").toString().trim();
  const amount = Number(form.get("amount"));
  const value = Number(form.get("value"));
  if (!name || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(value) || value <= 0) {
    showToast("Проверьте поля расхода", "warn");
    return;
  }
  const payload = { id: currentId || makeExpenseId(), name, amount: Math.abs(amount), value };
  const next = currentId ? expenses.map((item) => (item.id === currentId ? payload : item)) : [...expenses, payload];
  saveExpenses(next);
  event.currentTarget.reset();
  closeModal();
  render();
  showToast(currentId ? "Расход обновлен" : "Расход добавлен", "good");
});

document.querySelector("#expenseDetailStack").addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const editId = target.dataset.editExpense;
  if (editId) {
    const expense = expenses.find((item) => item.id === editId);
    if (!expense) return;
    const form = document.querySelector("#expenseForm");
    form.elements.id.value = expense.id;
    form.elements.name.value = expense.name;
    form.elements.amount.value = expense.amount;
    form.elements.value.value = expense.value;
    document.querySelector("#expenseModalTitle").textContent = "Изменить расход";
    document.querySelector("#expenseSubmit").textContent = "Сохранить";
    openModal("expenseModal");
    return;
  }
  const deleteId = target.dataset.deleteExpense;
  if (!deleteId) return;
  const approved = window.confirm("Удалить этот расход?");
  if (!approved) return;
  saveExpenses(expenses.filter((item) => item.id !== deleteId));
  render();
  showToast("Расход удален", "warn");
});

document.querySelector("#costForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.costImportRows = form
    .get("csv")
    .toString()
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean).length;
  closeModal();
  const button = document.querySelector("[data-modal-open='costModal']");
  button.textContent = `Импортировано: ${Math.max(0, state.costImportRows - 1)} строк`;
});

document.querySelector("#operationImportForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const imported = parseOperationsCsv(form.get("csv").toString());
  if (imported.length) {
    saveOperations([...getOperations(), ...imported]);
    render();
    showToast(`Импортировано ${imported.length} операций`, "good");
  } else {
    showToast("Не удалось импортировать операции", "warn");
  }
  event.currentTarget.reset();
  closeModal();
});

document.querySelector("#operationAddForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const currentId = form.get("id")?.toString() || "";
  const date = form.get("date").toString();
  const market = form.get("market").toString().trim();
  const category = form.get("category").toString().trim();
  const sku = form.get("sku").toString().trim();
  const rawAmount = Number(form.get("amount"));
  const selectedType = form.get("type").toString();
  const parsedDate = new Date(date);
  const isDateValid = Boolean(date) && !Number.isNaN(parsedDate.getTime());
  if (!isDateValid) {
    showToast("Укажите корректную дату", "warn");
    return;
  }
  if (!category || !sku || !market) {
    showToast("Заполните обязательные поля", "warn");
    return;
  }
  if (!Number.isFinite(rawAmount) || rawAmount === 0) {
    showToast("Сумма должна быть больше 0", "warn");
    return;
  }
  const amount = selectedType === "expense" ? -Math.abs(rawAmount) : Math.abs(rawAmount);
  const payload = {
    id: currentId || makeOperationId(),
    date,
    market,
    category,
    sku,
    amount,
    type: selectedType
  };
  const next = currentId ? getOperations().map((row) => (row.id === currentId ? payload : row)) : [...getOperations(), payload];
  saveOperations(next);
  event.currentTarget.reset();
  document.querySelector("#operationAddModalTitle").textContent = "Добавить операцию";
  document.querySelector("#operationAddSubmit").textContent = "Добавить";
  closeModal();
  render();
  showToast(currentId ? "Операция обновлена" : "Операция добавлена", "good");
});

document.querySelector("#operationsTable").addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const editId = target.dataset.editOperation;
  if (editId) {
    const row = getOperations().find((item) => item.id === editId);
    if (!row) return;
    const form = document.querySelector("#operationAddForm");
    form.elements.id.value = row.id;
    form.elements.date.value = row.date;
    form.elements.market.value = row.market;
    form.elements.category.value = row.category;
    form.elements.sku.value = row.sku;
    form.elements.amount.value = Math.abs(row.amount);
    form.elements.type.value = row.type;
    document.querySelector("#operationAddModalTitle").textContent = "Изменить операцию";
    document.querySelector("#operationAddSubmit").textContent = "Сохранить";
    openModal("operationAddModal");
    return;
  }
  const id = target.dataset.deleteOperation;
  if (!id) return;
  const approved = window.confirm("Удалить эту операцию?");
  if (!approved) return;
  saveOperations(getOperations().filter((row) => row.id !== id));
  render();
  showToast("Операция удалена", "warn");
});

document.querySelector("#operationsSelectAll").addEventListener("change", (event) => {
  const checked = event.target.checked;
  document.querySelectorAll("#operationsTable .operation-select").forEach((checkbox) => {
    checkbox.checked = checked;
  });
});

document.querySelector("#operationsTable").addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains("operation-select")) return;
  const items = [...document.querySelectorAll("#operationsTable .operation-select")];
  const allChecked = items.length > 0 && items.every((checkbox) => checkbox.checked);
  document.querySelector("#operationsSelectAll").checked = allChecked;
});

document.querySelector("#deleteSelectedOperations").addEventListener("click", () => {
  const selectedIds = [...document.querySelectorAll("#operationsTable .operation-select:checked")].map((node) => node.dataset.operationId);
  if (!selectedIds.length) {
    showToast("Выберите операции для удаления", "warn");
    return;
  }
  const approved = window.confirm(`Удалить выбранные операции: ${selectedIds.length} шт.?`);
  if (!approved) return;
  const selectedSet = new Set(selectedIds);
  saveOperations(getOperations().filter((row) => !selectedSet.has(row.id)));
  render();
  showToast(`Удалено операций: ${selectedIds.length}`, "warn");
});

document.querySelector("#resetOperations").addEventListener("click", () => {
  const approved = window.confirm("Сбросить журнал операций к демо-данным?");
  if (!approved) return;
  saveOperations(defaultOperations);
  render();
  showToast("Журнал операций сброшен", "warn");
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.activeModal) closeModal();
});

window.addEventListener("hashchange", setActivePage);

restoreFilters();
expenses = getExpenses();
render();
refreshAlertFeed().catch(() => {});
refreshProfitLeaks().catch(() => {});
