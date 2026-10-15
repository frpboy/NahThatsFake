/** Escapes untrusted text embedded in Telegram's legacy Markdown parse mode. */
export function escapeMarkdown(value: string): string {
  return value.replace(/([\\_*[\]()`])/g, '\\$1');
}
