/* global MAGNIT_JEOPARDY_QUESTION_SETS */

const VALUES = [200, 400, 600, 800, 1000];

function formatMoney(n) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString()}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickQuestionSet() {
  if (!Array.isArray(MAGNIT_JEOPARDY_QUESTION_SETS) || MAGNIT_JEOPARDY_QUESTION_SETS.length === 0) {
    throw new Error("No question sets available.");
  }
  return MAGNIT_JEOPARDY_QUESTION_SETS[0];
}

function buildBoardData(set) {
  const categories = shuffle(set.categories).slice(0, 6).map((cat) => {
    const normalizedClues = VALUES.map((v) => {
      const match = cat.clues.find((c) => c.value === v);
      if (!match) {
        return { value: v, clue: "Missing clue.", answer: "Missing answer.", used: false };
      }
      return { ...match, used: false };
    });
    return { title: cat.title, clues: normalizedClues };
  });
  return { setTitle: set.title, categories };
}

function createCell(className, contentNode) {
  const cell = document.createElement("div");
  cell.className = `cell ${className || ""}`.trim();
  if (contentNode) cell.appendChild(contentNode);
  return cell;
}

function createHeader(categoryTitle) {
  const wrap = document.createElement("div");
  wrap.className = "category";
  wrap.textContent = categoryTitle;
  return wrap;
}

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el;
}

const state = {
  boardData: null,
  score: 0,
  active: null, // { cIdx, rIdx }
  revealAnswer: false,
};

function updateScore(delta) {
  state.score += delta;
  $("scoreValue").textContent = formatMoney(state.score);
}

function setScoreAbsolute(n) {
  state.score = n;
  $("scoreValue").textContent = formatMoney(state.score);
}

function closeModal() {
  state.active = null;
  state.revealAnswer = false;
  $("modalOverlay").hidden = true;
  $("modal").hidden = true;
  $("answerText").hidden = true;
  $("showAnswerBtn").disabled = false;
  $("correctBtn").disabled = true;
  $("incorrectBtn").disabled = true;
}

function openModal({ cIdx, rIdx }) {
  const cat = state.boardData.categories[cIdx];
  const clueObj = cat.clues[rIdx];

  state.active = { cIdx, rIdx };
  state.revealAnswer = false;

  $("modalKicker").textContent = `${state.boardData.setTitle} • ${cat.title}`;
  $("modalTitle").textContent = `For ${formatMoney(clueObj.value)}`;
  $("valuePill").textContent = formatMoney(clueObj.value);
  $("clueText").textContent = clueObj.clue;
  $("answerText").textContent = clueObj.answer;
  $("answerText").hidden = true;

  $("showAnswerBtn").disabled = false;
  $("correctBtn").disabled = true;
  $("incorrectBtn").disabled = true;

  $("modalOverlay").hidden = false;
  $("modal").hidden = false;

  $("closeModalBtn").focus();
}

function revealAnswer() {
  state.revealAnswer = true;
  $("answerText").hidden = false;
  $("showAnswerBtn").disabled = true;
  $("correctBtn").disabled = false;
  $("incorrectBtn").disabled = false;
}

function markUsedAndScore(isCorrect) {
  if (!state.active) return;
  const { cIdx, rIdx } = state.active;
  const clueObj = state.boardData.categories[cIdx].clues[rIdx];
  if (clueObj.used) return;

  clueObj.used = true;
  const delta = isCorrect ? clueObj.value : -clueObj.value;
  updateScore(delta);
  renderBoard();
  closeModal();
}

function resetGame() {
  setScoreAbsolute(0);
  if (!state.boardData) return;
  state.boardData.categories.forEach((cat) => cat.clues.forEach((c) => (c.used = false)));
  renderBoard();
  closeModal();
}

function newBoard() {
  const set = pickQuestionSet();
  state.boardData = buildBoardData(set);
  setScoreAbsolute(0);
  renderBoard();
  closeModal();
}

function renderBoard() {
  const board = $("board");
  board.innerHTML = "";

  // Header row
  for (let c = 0; c < 6; c++) {
    const header = createHeader(state.boardData.categories[c].title);
    board.appendChild(createCell("header", header));
  }

  // 5 rows of values
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      const clueObj = state.boardData.categories[c].clues[r];

      const btn = document.createElement("button");
      btn.className = `tile-btn${clueObj.used ? " used" : ""}`;
      btn.type = "button";
      btn.textContent = formatMoney(clueObj.value);
      btn.disabled = clueObj.used;
      btn.setAttribute("aria-label", `${state.boardData.categories[c].title}, ${formatMoney(clueObj.value)}`);

      btn.addEventListener("click", () => {
        if (clueObj.used) return;
        openModal({ cIdx: c, rIdx: r });
      });

      board.appendChild(createCell("", btn));
    }
  }
}

function onKeydown(e) {
  if ($("modal").hidden) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeModal();
  }
}

function init() {
  $("closeModalBtn").addEventListener("click", closeModal);
  $("modalOverlay").addEventListener("click", closeModal);
  $("showAnswerBtn").addEventListener("click", revealAnswer);
  $("correctBtn").addEventListener("click", () => markUsedAndScore(true));
  $("incorrectBtn").addEventListener("click", () => markUsedAndScore(false));
  $("resetBtn").addEventListener("click", resetGame);
  $("shuffleBtn").addEventListener("click", newBoard);

  document.addEventListener("keydown", onKeydown);

  newBoard();
}

init();

