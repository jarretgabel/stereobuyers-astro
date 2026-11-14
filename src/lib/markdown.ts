import { marked } from 'marked';

/** CMS-edited text → HTML. Headings map to the site's heading styles: ### → as-h3, #### → as-h4, ##### → as-strong. */
export function renderMd(text: unknown): string {
  let html = marked.parse(String(text ?? ''), { breaks: true, gfm: false, async: false }) as string;
  for (const [n, cls] of [['1', 'as-h1'], ['3', 'as-h3'], ['4', 'as-h4'], ['5', 'as-strong']]) {
    html = html.replaceAll(`<h${n}>`, `<h2 class="${cls}">`).replaceAll(`</h${n}>`, '</h2>');
  }
  return html;
}

/** Splits text on horizontal rules into independent chunks (one page section each). */
export const splitSections = (text: unknown) =>
  String(text ?? '').split(/^\s*---\s*$/m).map((s) => s.trim()).filter(Boolean);
