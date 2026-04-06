import { mkdir } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import Automizer, { ModifyTextHelper, modify } from "pptx-automizer";
import type { DeckPlan, SlidePlan } from "@/lib/deck-types";
import {
  TEMPLATE_FILE,
  TEMPLATE_SHAPE_BODY,
  TEMPLATE_SHAPE_TITLE,
} from "@/lib/deck-types";

export const runtime = "nodejs";
export const maxDuration = 120;

const TPL_LABEL = "brand";

function isSlidePlan(x: unknown): x is SlidePlan {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    Array.isArray(o.bullets) &&
    o.bullets.every((b) => typeof b === "string")
  );
}

function isDeckPlan(x: unknown): x is DeckPlan {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.deckTitle === "string" &&
    Array.isArray(o.slides) &&
    o.slides.length > 0 &&
    o.slides.every(isSlidePlan)
  );
}

function safeBasename(title: string): string {
  const t = title.replace(/[^\w\s-]+/g, "").replace(/\s+/g, "-");
  return (t || "labor-market-deck").slice(0, 80);
}

function bodyParagraphs(slide: SlidePlan) {
  if (slide.bullets.length === 0) {
    return [
      {
        paragraph: {} as const,
        textRuns: [{ text: "\u00a0" }],
      },
    ];
  }
  return slide.bullets.map((b) => ({
    paragraph: { bullet: true as const, level: 0 as const },
    textRuns: [{ text: b }],
  }));
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const plan = (body as { plan?: unknown })?.plan;
  if (!isDeckPlan(plan)) {
    return Response.json(
      { error: "Body must include a valid { plan: DeckPlan } object." },
      { status: 400 },
    );
  }

  if (plan.slides.length > 24) {
    return Response.json(
      { error: "Deck has too many slides (max 24)." },
      { status: 400 },
    );
  }

  const assetsDir = path.join(process.cwd(), "assets");
  const outDir = path.join(tmpdir(), "labor-market-pptx");

  try {
    await mkdir(outDir, { recursive: true });
  } catch {
    return Response.json(
      { error: "Could not prepare temp output directory." },
      { status: 500 },
    );
  }

  let pres = new Automizer({
    templateDir: assetsDir,
    templateFallbackDir: assetsDir,
    outputDir: outDir,
    removeExistingSlides: true,
    autoImportSlideMasters: true,
    compression: 3,
    verbosity: 0,
  })
    .loadRoot(TEMPLATE_FILE)
    .load(TEMPLATE_FILE, TPL_LABEL);

  for (const slide of plan.slides) {
    pres = pres.addSlide(TPL_LABEL, 1, (s) => {
      s.modifyElement(TEMPLATE_SHAPE_TITLE, [
        ModifyTextHelper.setText(slide.title),
      ]);
      s.modifyElement(TEMPLATE_SHAPE_BODY, [
        modify.setMultiText(bodyParagraphs(slide)),
      ]);
    });
  }

  try {
    const zip = await pres.getJSZip();
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const filename = `${safeBasename(plan.deckTitle)}.pptx`;
    return new Response(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "PowerPoint export failed.";
    return Response.json(
      {
        error: message,
        hint:
          "Confirm assets/branding-template.pptx exists and shapes Title 3 / Text Placeholder 3 are present (or update TEMPLATE_SHAPE_* in src/lib/deck-types.ts).",
      },
      { status: 500 },
    );
  }
}
