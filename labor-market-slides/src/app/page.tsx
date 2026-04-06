"use client";

import { useCallback, useState } from "react";
import type { DeckPlan } from "@/lib/deck-types";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<DeckPlan | null>(null);
  const [loading, setLoading] = useState<"plan" | "export" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setError(null);
    setLoading("plan");
    try {
      const res = await fetch("/api/plan-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed.");
        return;
      }
      setPlan(data as DeckPlan);
    } catch {
      setError("Network error while generating the deck.");
    } finally {
      setLoading(null);
    }
  }, [prompt]);

  const exportPptx = useCallback(async () => {
    if (!plan) return;
    setError(null);
    setLoading("export");
    try {
      const res = await fetch("/api/export-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.error === "string"
            ? data.error
            : "Export failed. Check server logs and template assets.",
        );
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      const name = match?.[1] ?? "deck.pptx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error while exporting.");
    } finally {
      setLoading(null);
    }
  }, [plan]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10 sm:px-6">
      <header className="mb-10">
        <p className="text-sm font-medium text-[var(--muted)]">
          Labor market intelligence
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Deck builder
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          Describe the research question, audience, and geography. The app drafts
          slides from your brief and exports a branded .pptx using your template in{" "}
          <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[13px] text-[var(--text)]">
            assets/branding-template.pptx
          </code>
          .
        </p>
      </header>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <label className="text-sm font-medium text-[var(--muted)]" htmlFor="brief">
            Research brief
          </label>
          <textarea
            id="brief"
            rows={14}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: Q1 2026 outlook for acute-care nursing labor supply in the US Southeast for a health system CHRO audience. Include traveler share, wage pressure, and retention themes."
            className="min-h-[220px] resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={loading !== null || !prompt.trim()}
              className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-dim)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading === "plan" ? "Generating…" : "Generate slides"}
            </button>
            <button
              type="button"
              onClick={() => void exportPptx()}
              disabled={loading !== null || !plan}
              className="rounded-lg border border-[var(--border)] bg-transparent px-5 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading === "export" ? "Building file…" : "Download .pptx"}
            </button>
          </div>
          {error ? (
            <p
              className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex min-h-[320px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 sm:p-6">
          {!plan ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-[var(--muted)]">
              <p className="max-w-sm text-sm leading-relaxed">
                Slide previews appear here after generation. You can tweak the brief
                and regenerate until the outline fits, then download PowerPoint.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text)]">
                    {plan.deckTitle}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {plan.slides.length} slides · exported layout matches your
                    template
                  </p>
                </div>
              </div>
              <ul className="custom-scroll max-h-[min(60vh,560px)] space-y-4 overflow-y-auto pr-1">
                {plan.slides.map((s, i) => (
                  <li
                    key={`${i}-${s.title}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                      Slide {i + 1}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-[var(--text)]">
                      {s.title}
                    </h3>
                    {s.bullets.length > 0 ? (
                      <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-[var(--muted)]">
                        {s.bullets.map((b, j) => (
                          <li key={j} className="marker:text-[var(--accent)]">
                            {b}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
