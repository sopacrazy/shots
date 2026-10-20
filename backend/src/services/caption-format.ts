export const LINK_CALL_TO_ACTION = 'Comente LINK para receber o link do produto no Direct.';

export function captionWithCallToAction(caption: string): string {
  const description = caption.trim();
  // Keep an existing complete invitation, including natural variations from the AI.
  const invitation = /\b(?:comente|comenta|comentar|digite|digita|digitar|escreva)\b[^.!?\n]{0,160}\blink\b[^.!?\n]{0,160}\b(?:direct|privado|inbox)\b/iu;
  return invitation.test(description) ? description : [description, LINK_CALL_TO_ACTION].filter(Boolean).join('\n\n');
}

export function formatPublicationCaption(caption: string, affiliate?: string | null): string {
  const description = captionWithCallToAction(caption);
  const link = affiliate?.trim();
  return link && !description.includes(link) ? `${description}\n\n${link}` : description;
}
