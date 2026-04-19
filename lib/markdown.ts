export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeMarkdownText(text: string) {
  return text
    .replace(/<data>[\s\S]*?<\/data>/g, '')
    .replace(/<!--DOC_START-->/g, '')
    .replace(/<!--DOC_END-->/g, '');
}

export function applyInlineMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(¥\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?元)/g, '<span class="money text-[var(--color-warning)] font-semibold">$1</span>');
}

export function renderMarkdown(rawText: string) {
  if (!rawText) return { __html: '' };
  
  const clean = sanitizeMarkdownText(rawText).trim();
  if (!clean) return { __html: '' };

  const lines = clean.split(/\r?\n/);
  const html = [];
  let listType: string | null = null;

  function closeList() {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      closeList();
      html.push('<hr class="h-px my-3 border-0 bg-[var(--color-border)]">');
      continue;
    }

    const unordered = trimmed.match(/^[-•]\s+(.+)$/);
    if (unordered) {
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        html.push('<ul class="my-2 pl-5">');
      }
      html.push(`<li>${applyInlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        html.push('<ol class="my-2 pl-5 list-decimal">');
      }
      html.push(`<li>${applyInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p class="m-0 mb-2 last:mb-0">${applyInlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  return { __html: html.join('') };
}

export function parseUserContext(rawText: string, currentContext: Record<string, unknown>) {
  const regex = /<data>(.*?)<\/data>/gs;
  let match;
  let newContext = { ...currentContext };
  while ((match = regex.exec(rawText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        newContext = { ...newContext, ...parsed };
      }
    } catch (error) {
      console.warn('无法解析 <data> 上下文', error);
    }
  }
  return newContext;
}
