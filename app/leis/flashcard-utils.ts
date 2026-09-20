export const FLASHCARD_PLACEHOLDER = "<p>Os flashcards desta unidade aparecerão quando o snapshot for sincronizado a partir do Notion.</p>";

export type FlashcardPair = {
  questionHtml: string;
  answerHtml: string;
};

export function extractFlashcardHtml(html: string) {
  const match = html.match(/<h([23])\b[^>]*>(?:(?!<\/h[23]>)[\s\S])*?Flashcards(?:(?!<\/h[23]>)[\s\S])*?<\/h\1>([\s\S]*?)(?=<h[23]\b[^>]*>(?:(?!<\/h[23]>)[\s\S])*?(?:D0|D7|D20|Revis(?:ões|ão)|fechamento)(?:(?!<\/h[23]>)[\s\S])*?<\/h[23]>|$)/i);
  return match?.[2]?.trim() || FLASHCARD_PLACEHOLDER;
}

export function extractFlashcardPairs(fragment: string): FlashcardPair[] {
  return [...fragment.matchAll(/(?:<ol\b[^>]*>\s*<li\b[^>]*>|<p\b[^>]*>)\s*<strong>(?:\d+\.\s*)?Frente:<\/strong>\s*([\s\S]*?)(?:<\/li>\s*<\/ol>|<\/p>)\s*<p\b[^>]*>\s*<strong>Verso:<\/strong>\s*([\s\S]*?)<\/p>/gi)]
    .map((match) => ({ questionHtml: match[1].trim(), answerHtml: match[2].trim() }));
}
