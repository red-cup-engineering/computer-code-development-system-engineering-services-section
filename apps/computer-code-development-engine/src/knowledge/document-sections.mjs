/** Stable work addresses for the sections of a long Markdown document. */
const LONG_DOCUMENT = 16_000;

export function documentSections(relative, source) {
  if (!/\.(?:md|markdown)$/i.test(relative) || source.length <= LONG_DOCUMENT) return [];
  const headings = [...source.matchAll(/^## (?<title>.+)$/gm)];
  if (headings.length === 0) return [];
  const boundaries = [0, ...headings.map((match) => match.index), source.length];
  return boundaries.slice(0, -1).map((start, index) => Object.freeze({
    address: `${relative}#section-${index}`,
    title: index === 0 ? "Introduction" : headings[index - 1].groups.title,
    source: source.slice(start, boundaries[index + 1]).trim(),
  })).filter((section) => section.source.length > 0);
}
