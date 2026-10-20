import { problem } from './local.service.js';
import { formatPublicationCaption } from './caption-format.js';

export function affiliateUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) throw problem('Link de afiliado inválido');
  const input = value.trim();
  if (!input) return null;
  let url: URL;
  try { url = new URL(input); } catch { throw problem('Informe o link completo do produto, começando com https://'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw problem('Use um link HTTP ou HTTPS válido para o produto');
  return url.href;
}

export function publicationCaption(caption: string, affiliate: string | null | undefined): string {
  const result = formatPublicationCaption(caption, affiliate);
  if (result.length > 2200) throw problem('A descrição, a chamada para comentar LINK e o link juntos devem ter até 2200 caracteres');
  return result;
}
