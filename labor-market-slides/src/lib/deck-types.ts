export type SlidePlan = {
  title: string;
  bullets: string[];
  speakerNotes?: string;
};

export type DeckPlan = {
  deckTitle: string;
  slides: SlidePlan[];
};

export const TEMPLATE_FILE = "branding-template.pptx";
/** Shape names on slide 1 of the bundled template (Selection Pane in PowerPoint). */
export const TEMPLATE_SHAPE_TITLE = "Title 3";
export const TEMPLATE_SHAPE_BODY = "Text Placeholder 3";
