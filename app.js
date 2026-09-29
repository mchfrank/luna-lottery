const cfg = window.LUNA_CONFIG || {};
const SUPABASE_URL = cfg.SUPABASE_URL;
const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY;

const nameInput = document.getElementById("name");
const spinButton = document.getElementById("spinButton");
const errorBox = document.getElementById("error");
const formView = document.getElementById("formView");
const resultView = document.getElementById("resultView");
const prizeBox = document.getElementById("prize");
const couponBox = document.getElementById("couponBox");
const couponEl = document.getElementById("coupon");
const copyButton = document.getElementById("copyButton");
const overlay = document.getElementById("rouletteOverlay");
const rollingPrize = document.getElementById("rollingPrize");
const winnersList = document.getElementById("winnersList");
const winnerCount = document.getElementById("winnerCount");

const demoPrizes = (window.LUNA_PRIZES || []).map(x => x.name);

function configured() {
  return SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("PASTE_") &&
    !SUPABASE_ANON_KEY.includes("PASTE_");
}

function headers() {
  return {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

async function api(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Ошибка сервера");
  }
  return data;
}

async function loadWinners() {
  if (!configured()) {
    winnersList.innerHTML = `<div class="loading">После подключения Supabase здесь появятся победители.</div>`;
    winnerCount.textContent = "0 участников";
    return;
  }

  try {
    const rows = await api("/rest/v1/winners?select=character_name,prize_name,created_at&order=created_at.desc");
    winnerCount.textContent = `${rows.length} ${plural(rows.length, "участник", "участника", "участников")}`;
    if (!rows.length) {
      winnersList.innerHTML = `<div class="loading">Пока никто не выиграл.</div>`;
      return;
    }
    winnersList.innerHTML = rows.map(row => `
      <div class="winner">
        <div class="winner-name">${escapeHtml(row.character_name)}</div>
        <div class="winner-prize">${escapeHtml(row.prize_name)}</div>
      </div>
    `).join("");
  } catch (err) {
    winnersList.innerHTML = `<div class="loading">Не удалось загрузить список победителей.</div>`;
  }
}

function plural(n, one, few, many) {
  const x = n % 100;
  if (x >= 11 && x <= 19) return many;
  switch (n % 10) {
    case 1: return one;
    case 2: case 3: case 4: return few;
    default: return many;
  }
}

function showError(message) {
  errorBox.textContent = message;
}

function showResult(data) {
  prizeBox.textContent = data.prize_name;
  if (data.coupon_code) {
    couponEl.textContent = data.coupon_code;
    couponBox.classList.remove("hidden");
  }
  formView.classList.add("hidden");
  resultView.classList.remove("hidden");
}

async function spin() {
  showError("");
  const rawName = nameInput.value;
  const characterName = rawName.trim();

  if (!characterName) {
    showError("Введите имя персонажа.");
    nameInput.focus();
    return;
  }

  if (!configured()) {
    showError("Сайт ещё не подключён к базе Supabase. Заполните config.js.");
    return;
  }

  spinButton.disabled = true;
  overlay.classList.remove("hidden");

  let timer = null;
  try {
    // The server chooses the actual prize. Animation is only visual.
    timer = setInterval(() => {
      rollingPrize.textContent = demoPrizes[Math.floor(Math.random() * demoPrizes.length)] || "…";
    }, 80);

    const result = await api("/rest/v1/rpc/draw_lottery", {
      method: "POST",
      body: JSON.stringify({ p_name: characterName })
    });

    clearInterval(timer);
    rollingPrize.textContent = result.prize_name;
    await new Promise(resolve => setTimeout(resolve, 900));
    overlay.classList.add("hidden");
    showResult(result);
    await loadWinners();
  } catch (err) {
    if (timer) clearInterval(timer);
    overlay.classList.add("hidden");
    showError(err.message || "Не удалось провести розыгрыш.");
    spinButton.disabled = false;
  }
}

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(couponEl.textContent);
    copyButton.textContent = "Скопировано";
    setTimeout(() => copyButton.textContent = "Скопировать код", 1500);
  } catch {}
});

spinButton.addEventListener("click", spin);
nameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") spin();
});

loadWinners();
