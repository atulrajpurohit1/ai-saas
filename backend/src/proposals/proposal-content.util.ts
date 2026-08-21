// Matches unfilled AI-template placeholder tokens like "[Your Company Name]"
// while ignoring Markdown link/image syntax ("[label](url)" / "![alt](url)"),
// which uses the same bracket characters for a legitimate purpose.
const PLACEHOLDER_PATTERN = /\[[^[\]\n]{2,60}\](?!\()/g;

export function findUnresolvedPlaceholders(content: string): string[] {
  if (!content) return [];

  const matches = content.match(PLACEHOLDER_PATTERN) || [];
  return [...new Set(matches)];
}
