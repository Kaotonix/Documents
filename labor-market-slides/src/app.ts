const LS_KEY = "magnit_openai_key";

export type DeckSlide = { title: string; bullets: string[] };
export type DeckPlan = { deckTitle?: string; slides: DeckSlide[] };

function loadKey(): string {
  try {
    return localStorage.getItem(LS_KEY) || "";
  } catch {
    return "";
  }
}

function saveKey(k: string) {
  try {
    localStorage.setItem(LS_KEY, k);
  } catch {
    /* ignore */
  }
}

async function planDeck(prompt: string, apiKey: string): Promise<DeckPlan> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch("/api/plan-deck", {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt }),
  });
  const text = await res.text();
  if (!res.ok) {
    let err = text;
    try {
      err = JSON.parse(text).error || text;
    } catch {
      /* raw */
    }
    throw new Error(err);
  }
  return JSON.parse(text) as DeckPlan;
}

async function exportPptx(slides: DeckSlide[], filename: string): Promise<void> {
  const res = await fetch("/api/export-pptx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slides, filename }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderSlidePreview(slide: DeckSlide, index: number): string {
  const bullets =
    slide.bullets?.length > 0
      ? `<ul class="slide-bullets">${slide.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
      : `<ul class="slide-bullets"><li>${escapeHtml("Add bullets in PowerPoint.")}</li></ul>`;

  return `
    <div class="slide-frame" aria-label="Slide ${index + 1} preview">
      <img class="slide-left-visual" src="/brand-left.png" alt="" />
      <div class="slide-bg-bar"></div>
      <span class="slide-num">${index + 1}</span>
      <span class="slide-rule" aria-hidden="true"></span>
      <span class="slide-footer-copy">© Magnit Global, All Rights Reserved</span>
      <img class="slide-footer-logo" src="/brand-footer-logo.png" alt="Magnit" />
      <div class="slide-content">
        <h3 class="slide-title">${escapeHtml(slide.title)}</h3>
        ${bullets}
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mountApp(root: HTMLElement) {
  let deck: DeckPlan | null = null;

  root.innerHTML = `
    <div class="shell">
      <header>
        <h1>Magnit Slide Studio</h1>
        <p>
          Describe the story you want (research, BLS, fraud trends, etc.). We draft slides in your Magnit layout;
          export downloads a real .pptx using the same master as your template pack.
          On Vercel, set OPENAI_API_KEY in the project environment and you can leave the key field below empty.
        </p>
      </header>
      <div class="workspace">
        <section class="panel">
          <h2>Prompt</h2>
          <label class="key" for="prompt">What should this deck cover?</label>
          <textarea id="prompt" class="prompt" placeholder="Example: Summarize the latest BLS jobs report into 5 slides with key charts to mention and executive takeaways."></textarea>
          <label class="key" for="apikey">OpenAI API key (optional if OPENAI_API_KEY is set on the server)</label>
          <input id="apikey" class="api-key" type="password" autocomplete="off" placeholder="sk-..." />
          <div class="row">
            <button type="button" class="primary" id="btn-gen">Generate preview</button>
            <button type="button" class="secondary" id="btn-export" disabled>Download .pptx</button>
          </div>
          <p class="status" id="status"></p>
        </section>
        <section class="panel">
          <h2>Preview</h2>
          <div id="preview" class="preview-scroll">
            <div class="empty-preview" id="preview-empty">
              Generated slides appear here with the Magnit frame: left visual, title color, footer strip, and Montserrat styling (web preview is approximate).
            </div>
            <div id="preview-deck" hidden></div>
          </div>
        </section>
      </div>
    </div>
  `;

  const promptEl = root.querySelector<HTMLTextAreaElement>("#prompt")!;
  const keyEl = root.querySelector<HTMLInputElement>("#apikey")!;
  const btnGen = root.querySelector<HTMLButtonElement>("#btn-gen")!;
  const btnExport = root.querySelector<HTMLButtonElement>("#btn-export")!;
  const statusEl = root.querySelector<HTMLElement>("#status")!;
  const previewEmpty = root.querySelector<HTMLElement>("#preview-empty")!;
  const previewDeck = root.querySelector<HTMLElement>("#preview-deck")!;

  keyEl.value = loadKey();
  keyEl.addEventListener("change", () => saveKey(keyEl.value.trim()));

  function setStatus(msg: string, isErr = false) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("error", isErr);
  }

  function renderDeck(d: DeckPlan) {
    deck = d;
    const title = d.deckTitle?.trim() || "Generated deck";
    previewEmpty.hidden = true;
    previewDeck.hidden = false;
    previewDeck.innerHTML = `
      <div class="preview-deck-title">${escapeHtml(title)}</div>
      ${d.slides.map((s, i) => renderSlidePreview(s, i)).join("")}
    `;
    btnExport.disabled = d.slides.length === 0;
  }

  btnGen.addEventListener("click", async () => {
    const prompt = promptEl.value.trim();
    if (!prompt) {
      setStatus("Enter a prompt first.", true);
      return;
    }
    btnGen.disabled = true;
    btnExport.disabled = true;
    setStatus("Calling the model…");
    try {
      const plan = await planDeck(prompt, keyEl.value.trim());
      renderDeck(plan);
      setStatus(`Ready — ${plan.slides.length} slide(s). Export matches Magnit slide master (Agenda layout).`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Generation failed", true);
    } finally {
      btnGen.disabled = false;
    }
  });

  btnExport.addEventListener("click", async () => {
    if (!deck?.slides.length) return;
    btnExport.disabled = true;
    setStatus("Building PowerPoint…");
    try {
      const name = (deck.deckTitle || "Magnit-Deck").replace(/[^\w\s\-]+/g, "").trim().replace(/\s+/g, "-") || "Magnit-Deck";
      await exportPptx(deck.slides, name);
      setStatus("Download started.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Export failed", true);
    } finally {
      btnExport.disabled = false;
    }
  });
}
