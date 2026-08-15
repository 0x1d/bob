/**
 * Minimal HTML → Markdown converter.
 *
 * Strategy: walk the HTML token stream. Maintain a single output buffer
 * (`out`) and a stack of *contexts* — each context represents an open
 * element that wants to capture text (blockquote, table-cell, link, pre).
 * When the matching end tag fires, the captured text is formatted back
 * into `out`.
 *
 * No cheerio / turndown / external deps.
 */

export interface HtmlToMarkdownOptions {
  /** Reserved for future readability-style main-content extraction. */
  mainContent?: boolean;
  /** Drop short boilerplate-only lines. */
  stripBoilerplate?: boolean;
}

const SKIP_TAGS = new Set([
  'script', 'style', 'head', 'noscript', 'svg', 'math',
  'nav', 'footer', 'template', 'dialog', 'button', 'select',
  'datalist', 'iframe', 'object', 'form',
]);

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

const INLINE_EMPHASIS: Record<string, string> = {
  strong: '**',
  b: '**',
  em: '*',
  i: '*',
};

// Block-level tags that should produce a paragraph break in markdown.
const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'main', 'aside',
  'figure', 'details', 'summary', 'dl', 'dt', 'dd', 'header',
]);

// ---------------------------------------------------------------------------
// Boilerplate stripping
// ---------------------------------------------------------------------------

const BOILERPLATE_FRAGMENTS = [
  'skip to content',
  'skip to main content',
  'there was an error while loading',
  'please reload this page',
  "you can't perform that action at this time",
  'you signed in with another tab or window',
  'you signed out in another tab or window',
  'you switched accounts on another tab or window',
  'reload to refresh your session',
  'uh oh',
  'this website uses cookies',
  'we use cookies',
  'accept all cookies',
  'manage cookie preferences',
];

const BOILERPLATE_NORMALIZED = new Set(
  BOILERPLATE_FRAGMENTS.map((f) =>
    f.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!]+$/, ''),
  ),
);

function isBoilerplateLine(line: string): boolean {
  const normalized = line.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!]+$/, '');
  if (!normalized) return false;
  const segments = normalized
    .split(/[.!]/)
    .map((s) => s.trim().replace(/[.!]+$/, ''))
    .filter(Boolean);
  return segments.length > 0 && segments.every((s) => BOILERPLATE_NORMALIZED.has(s));
}

function stripBoilerplate(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const stripped = line.trim();
      if (stripped === '```' || stripped === '~~~') return true;
      if (stripped.length <= 300 && isBoilerplateLine(stripped)) return false;
      return true;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Hidden / attr parsing
// ---------------------------------------------------------------------------

function isHiddenElement(attrs: Record<string, string>): boolean {
  if (attrs['hidden'] !== undefined) return true;
  if (attrs['aria-hidden'] === 'true') return true;
  const style = attrs['style'];
  if (!style) return false;
  const lowered = style.toLowerCase();
  if (!/(^|;|\s)(display\s*:\s*none|visibility\s*:\s*hidden)/.test(lowered)) return false;
  for (const decl of style.split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    const propName = decl.slice(0, colon).trim().toLowerCase();
    const rawValue = decl.slice(colon + 1).split('!')[0].trim().toLowerCase();
    if (propName === 'display' && rawValue === 'none') return true;
    if (propName === 'visibility' && rawValue === 'hidden') return true;
  }
  return false;
}

function parseAttrs(rawAttrs: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!rawAttrs) return attrs;
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawAttrs)) !== null) {
    const key = m[1]!.toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    attrs[key] = decodeEntities(value);
  }
  return attrs;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// ---------------------------------------------------------------------------
// Converter
// ---------------------------------------------------------------------------

/** A capture context: the open element that wants to collect text. */
type Context =
  | { kind: 'link'; buf: string[]; href: string | null }
  | { kind: 'blockquote'; buf: string[] }
  | { kind: 'cell'; buf: string[] };

class HtmlToMarkdown {
  private out: string[] = [];
  private contexts: Context[] = [];

  private listStack: ('ul' | 'ol')[] = [];
  private olCounters: number[] = [];

  // Per-row cell collector (separate from `contexts` so we don't lose data
  // between adjacent cells).
  private currentRow: string[] = [];
  private activeCellBuf: string[] | null = null;

  private inPre = false;
  private inCode = false;

  // Stack of currently-open tags whose content must be ignored
  // (script, style, head, etc.).
  private skipStack: string[] = [];

  private readonly stripBoiler: boolean;

  constructor(options: HtmlToMarkdownOptions) {
    this.stripBoiler = options.stripBoilerplate ?? false;
  }

  convert(html: string): string {
    this.reset();
    this.tokenize(html);
    let result = this.out.join('');
    if (this.stripBoiler) result = stripBoilerplate(result);
    return result.replace(/\n{3,}/g, '\n\n').trim();
  }

  private reset(): void {
    this.out = [];
    this.contexts = [];
    this.listStack = [];
    this.olCounters = [];
    this.currentRow = [];
    this.activeCellBuf = null;
    this.inPre = false;
    this.inCode = false;
    this.skipStack = [];
  }

  /** Where text should go right now. */
  private sink(): string[] {
    if (this.activeCellBuf) return this.activeCellBuf;
    const last = this.contexts[this.contexts.length - 1];
    if (last) return last.buf;
    return this.out;
  }

  private handleData(data: string): void {
    if (this.skipStack.length > 0) return;
    if (this.inPre || this.inCode) {
      this.sink().push(data);
      return;
    }
    const text = data.replace(/[\t\n\r]+/g, ' ').trim();
    if (text) this.sink().push(text);
  }

  private handleStartTag(tagRaw: string): void {
    const spaceIdx = tagRaw.search(/\s/);
    const tag = (spaceIdx === -1 ? tagRaw : tagRaw.slice(0, spaceIdx)).toLowerCase();
    const rawAttrs = spaceIdx === -1 ? '' : tagRaw.slice(spaceIdx + 1);
    const attrs = parseAttrs(rawAttrs);

    if (SKIP_TAGS.has(tag)) {
      this.skipStack.push(tag);
      return;
    }
    if (isHiddenElement(attrs)) {
      this.skipStack.push(tag);
      return;
    }

    if (HEADING_TAGS.includes(tag as (typeof HEADING_TAGS)[number])) {
      const level = Number.parseInt(tag.slice(1), 10);
      this.out.push('\n\n' + '#'.repeat(level) + ' ');
      return;
    }

    if (tag in INLINE_EMPHASIS) {
      this.sink().push(INLINE_EMPHASIS[tag]!);
      return;
    }

    if (tag === 'a') {
      this.contexts.push({ kind: 'link', buf: [], href: attrs['href'] ?? null });
      return;
    }

    if (tag === 'br') {
      this.sink().push('\n');
      return;
    }

    if (BLOCK_TAGS.has(tag)) {
      // Emit blank-line gap to whichever sink is active (so a <p> inside a
      // <blockquote> routes its break to the bq buffer, not to out).
      this.sink().push('\n\n');
      return;
    }

    if (tag === 'hr') {
      this.out.push('\n\n---\n\n');
      return;
    }

    if (tag === 'blockquote') {
      this.out.push('\n\n');
      this.contexts.push({ kind: 'blockquote', buf: [] });
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      this.listStack.push(tag);
      if (tag === 'ol') this.olCounters.push(0);
      this.out.push('\n');
      return;
    }

    if (tag === 'li') {
      const indent = '  '.repeat(Math.max(0, this.listStack.length - 1));
      const isOl = this.listStack[this.listStack.length - 1] === 'ol';
      const marker = isOl
        ? `${(this.olCounters[this.olCounters.length - 1] ?? 0) + 1}. `
        : '- ';
      if (isOl && this.olCounters.length > 0) {
        this.olCounters[this.olCounters.length - 1]! += 1;
      }
      this.out.push(indent + marker);
      return;
    }

    if (tag === 'pre') {
      this.inPre = true;
      this.out.push('\n\n```\n');
      return;
    }

    if (tag === 'code') {
      this.inCode = true;
      this.sink().push('`');
      return;
    }

    if (tag === 'table') {
      this.out.push('\n\n');
      return;
    }

    if (tag === 'tr') {
      this.currentRow = [];
      return;
    }

    if (tag === 'th' || tag === 'td') {
      this.activeCellBuf = [];
      return;
    }
  }

  private handleEndTag(tagRaw: string): void {
    const tag = tagRaw.toLowerCase();

    if (this.skipStack.length > 0) {
      // Pop matching tag, but tolerate non-matching closes (defensive).
      if (this.skipStack[this.skipStack.length - 1] === tag) {
        this.skipStack.pop();
      } else if (this.skipStack.includes(tag)) {
        const idx = this.skipStack.lastIndexOf(tag);
        this.skipStack.splice(idx, 1);
      }
      return;
    }

    if (HEADING_TAGS.includes(tag as (typeof HEADING_TAGS)[number])) {
      this.out.push('\n\n');
      return;
    }

    if (tag === 'a') {
      const ctx = this.contexts.pop();
      if (ctx && ctx.kind === 'link') {
        const text = ctx.buf.join('').trim().replace(/\s+/g, ' ');
        if (text && ctx.href) {
          this.sink().push(`[${text}](${ctx.href})`);
        } else if (text) {
          this.sink().push(text);
        }
      }
      return;
    }

    if (tag in INLINE_EMPHASIS) {
      this.sink().push(INLINE_EMPHASIS[tag]!);
      return;
    }

    if (tag === 'br') {
      this.sink().push('\n');
      return;
    }

    if (BLOCK_TAGS.has(tag)) {
      this.sink().push('\n\n');
      return;
    }

    if (tag === 'blockquote') {
      const ctx = this.contexts.pop();
      if (ctx && ctx.kind === 'blockquote') {
        const content = ctx.buf.join('\n').trim();
        if (content) {
          const quoted = content
            .split('\n')
            .filter((l) => l.trim().length > 0)
            .map((l) => '> ' + l)
            .join('\n');
          this.out.push('\n\n' + quoted + '\n\n');
        }
      }
      return;
    }

    if (tag === 'ul') {
      this.listStack.pop();
      this.out.push('\n');
      return;
    }

    if (tag === 'ol') {
      this.listStack.pop();
      this.olCounters.pop();
      this.out.push('\n');
      return;
    }

    if (tag === 'pre') {
      this.inPre = false;
      this.out.push('\n```\n');
      return;
    }

    if (tag === 'code') {
      this.inCode = false;
      this.sink().push('`');
      return;
    }

    if (tag === 'th' || tag === 'td') {
      if (this.activeCellBuf) {
        const cell = this.activeCellBuf.join('').trim().replace(/\|/g, '\\|');
        this.currentRow.push(cell);
        this.activeCellBuf = null;
      }
      return;
    }

    if (tag === 'tr') {
      if (this.currentRow.length > 0) {
        const line = '| ' + this.currentRow.join(' | ') + ' |';
        this.out.push(line + '\n');
        const sep = '| ' + this.currentRow.map(() => '---').join(' | ') + ' |';
        this.out.push(sep + '\n');
      }
      this.currentRow = [];
      return;
    }

    if (tag === 'table') {
      this.out.push('\n');
      return;
    }
  }

  private tokenize(html: string): void {
    html = html.replace(/\r\n?/g, '\n');
    html = html.replace(/<!DOCTYPE[^>]*>/gi, '');
    html = html.replace(/<!--[\s\S]*?-->/g, '');

    let i = 0;
    while (i < html.length) {
      const lt = html.indexOf('<', i);
      if (lt === -1) {
        this.handleData(html.slice(i));
        break;
      }
      if (lt > i) this.handleData(html.slice(i, lt));
      const gt = html.indexOf('>', lt);
      if (gt === -1) break;
      const raw = html.slice(lt + 1, gt).trim();
      i = gt + 1;
      if (!raw) continue;

      if (raw.startsWith('!--')) continue;

      const isEnd = raw.startsWith('/');
      const isSelfClose = raw.endsWith('/');
      const body = isEnd ? raw.slice(1) : isSelfClose ? raw.slice(0, -1) : raw;
      const spaceIdx = body.search(/\s/);
      const tagName = (spaceIdx === -1 ? body : body.slice(0, spaceIdx)).toLowerCase();
      if (!tagName) continue;

      if (isEnd) {
        this.handleEndTag(tagName);
        continue;
      }

      if (VOID_TAGS.has(tagName)) {
        this.handleStartTag(tagName + (spaceIdx === -1 ? '' : body.slice(spaceIdx)));
        continue;
      }

      this.handleStartTag(body);

      if (isSelfClose) this.handleEndTag(tagName);
    }
  }
}

/** Convert an HTML string to Markdown. */
export function htmlToMarkdown(
  html: string,
  options: HtmlToMarkdownOptions = {},
): string {
  return new HtmlToMarkdown(options).convert(html);
}