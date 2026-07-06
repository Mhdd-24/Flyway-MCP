type TextContent = { type: 'text'; text: string };

export function toolText(text: string, isError = false): { isError: boolean; content: TextContent[] } {
  return { isError, content: [{ type: 'text', text }] };
}

export function toolError(error: unknown): { isError: true; content: TextContent[] } {
  const text = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: 'text', text }] };
}
