export function sanitizeMarkdownText(text: string) {
  return text
    .replace(/<data>[\s\S]*?<\/data>/g, '')
    .replace(/<!--DOC_START-->/g, '')
    .replace(/<!--DOC_END-->/g, '');
}

export function parseUserContext(rawText: string, currentContext: Record<string, unknown>) {
  const regex = /<data>([\s\S]*?)<\/data>/g;
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
