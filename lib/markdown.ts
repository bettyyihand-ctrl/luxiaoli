export function sanitizeMarkdownText(text: string) {
  return text
    .replace(/<data>[\s\S]*?<\/data>/g, '')
    .replace(/<!--DOC_START-->/g, '')
    .replace(/<!--DOC_END-->/g, '')
    .replace(/<!--\s*DOC_VARS_OUTPUT_START[\s\S]*?DOC_VARS_OUTPUT_END\s*-->/g, '');
}

export function parseDocVars(rawText: string): Record<string, string | number> | null {
  const match = rawText.match(/<!--\s*DOC_VARS_OUTPUT_START\s*([\s\S]*?)\s*DOC_VARS_OUTPUT_END\s*-->/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as { variables?: Record<string, string | number> };
    if (parsed?.variables && typeof parsed.variables === 'object' && !Array.isArray(parsed.variables)) {
      return parsed.variables;
    }
  } catch {
    console.warn('Failed to parse DOC_VARS JSON');
  }
  return null;
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
