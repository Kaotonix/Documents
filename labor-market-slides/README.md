# Labor Market Deck Builder

A small web app (similar in spirit to Gamma) for turning **labor market research briefs** into slide outlines with OpenAI, then exporting a **branded PowerPoint** built from your template file.

## Prerequisites

- Node.js 20+
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Local setup

```bash
cd labor-market-slides
npm install
cp .env.example .env.local
# Edit .env.local and set OPENAI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Branding template

The export pipeline uses **`assets/branding-template.pptx`**. This repo was initialized with a copy of your `2026 Fraud Slides backup 2.pptx` template.

Automation targets these shapes on **slide 1** of that file (check names in PowerPoint → **Alt+F10** Selection Pane):

- `Title 3` — slide title
- `Text Placeholder 3` — body (bullets)

To use a different layout, either edit those shape names in PowerPoint to match, or change `TEMPLATE_SHAPE_TITLE` / `TEMPLATE_SHAPE_BODY` in `src/lib/deck-types.ts`.

## Deploy to Vercel

1. Push this folder to a GitHub repository (this directory is a standalone Next.js app).
2. In [Vercel](https://vercel.com), **Import** the repo.
3. Add environment variable **`OPENAI_API_KEY`** (and optionally **`OPENAI_MODEL`**, e.g. `gpt-4o`).
4. Deploy. Long-running routes use `maxDuration` in `vercel.json` (requires a Vercel plan that allows extended duration if builds time out).

## GitHub

From your machine (adjust remote URL):

```bash
cd labor-market-slides
git init
git add .
git commit -m "Add labor market deck builder with PPTX export"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

If this folder should live inside a monorepo instead, set Vercel’s **Root Directory** to `labor-market-slides`.

## Stack

- Next.js (App Router), TypeScript, Tailwind CSS v4
- OpenAI Chat Completions + JSON schema for structured deck output
- [pptx-automizer](https://github.com/singerla/pptx-automizer) for template-based `.pptx` generation
