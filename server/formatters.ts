export function formatForAdapter(text: string, adapter: string): string {
  try {
    switch (adapter) {
      case "telegram":
        return formatForTelegram(text);
      default:
        return text;
    }
  } catch {
    return text;
  }
}

function formatForTelegram(text: string): string {
  let result = text;

  // Convert headers to bold
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");

  // Convert list items
  result = result.replace(/^[-*]\s+/gm, "• ");

  // Extract and protect formatted elements before escaping
  const tokens: string[] = [];
  function protect(s: string): string {
    tokens.push(s);
    return `\x00${tokens.length - 1}\x00`;
  }

  // Protect code blocks
  result = result.replace(/```[\s\S]*?```/g, (m) => protect(m));

  // Protect inline code
  result = result.replace(/`([^`]+)`/g, (m) => protect(m));

  // Convert **bold** to *bold* (Telegram uses single *)
  result = result.replace(/\*\*(.+?)\*\*/g, (_, c) => protect(`*${c}*`));

  // Convert __italic__ to _italic_
  result = result.replace(/__(.+?)__/g, (_, c) => protect(`_${c}_`));

  // Protect already-correct *bold* (from header conversion)
  result = result.replace(/\*([^*\n]+)\*/g, (m) => protect(m));

  // Protect links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m) => protect(m));

  // Escape special chars in remaining unprotected text
  result = result.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");

  // Restore protected tokens
  result = result.replace(/\x00(\d+)\x00/g, (_, i) => tokens[parseInt(i)]);

  // Clean up excessive newlines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}
