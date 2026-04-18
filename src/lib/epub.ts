/**
 * EPUB text extraction without external dependencies.
 * Unzips the EPUB (which is a ZIP), parses container.xml → content.opf
 * to find spine items, then extracts text from each XHTML chapter.
 */

import JSZip from 'jszip';

interface EpubChapter {
  id: string;
  title: string;
  href: string;
  order: number;
}

interface EpubMeta {
  title: string;
  author: string;
  coverHref: string | null;
  chapters: EpubChapter[];
  content: string; // concatenated plain text
}

/** Extract plain text from an XHTML document string */
function extractTextFromXhtml(html: string): string {
  // Remove XML declaration and DOCTYPE
  let text = html.replace(/<\?xml[^>]*\?>/gi, '');
  text = text.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Parse as a DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xhtml+xml');

  // Remove script, style, head elements
  doc.querySelectorAll('script, style, head, meta, link, svg, symbol').forEach(el => el.remove());

  // Walk the tree and collect visible text
  const lines: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const val = node.textContent ?? '';
      if (val.trim()) lines.push(val.trim());
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      // Block-level elements → new paragraph
      if (['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
           'li', 'blockquote', 'tr', 'hr'].includes(tag)) {
        lines.push('\n');
      }
      el.childNodes.forEach(walk);
      if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
           'li', 'blockquote', 'tr'].includes(tag)) {
        lines.push('\n');
      }
    }
  };
  walk(doc.body || doc.documentElement);

  // Collapse multiple newlines
  return lines.join(' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +/g, ' ')
    .trim();
}

/** Parse a content.opf OPF manifest+spine to ordered chapter list */
function parseOpf(opfText: string, opfBase: string): { chapters: EpubChapter[]; coverHref: string | null } {
  const chapters: EpubChapter[] = [];
  let coverHref: string | null = null;

  // Parse manifest items: id → href
  const itemMap = new Map<string, string>();
  const manifestRe = /<item[^>]+>/gi;
  let match: RegExpExecArray | null;
  while ((match = manifestRe.exec(opfText)) !== null) {
    const itemXml = match[0];
    const idMatch = itemXml.match(/id=["']([^"']+)["']/);
    const hrefMatch = itemXml.match(/href=["']([^"']+)["']/);
    const mediaMatch = itemXml.match(/media-type=["']([^"']+)["']/);
    if (idMatch && hrefMatch) {
      const id = idMatch[1];
      const href = hrefMatch[1];
      const mediaType = mediaMatch?.[1] ?? '';
      itemMap.set(id, href);

      // Detect cover image
      if (
        (id === 'cover-image' || id.toLowerCase().includes('cover')) &&
        mediaType.startsWith('image/')
      ) {
        coverHref = href;
      }
    }
  }

  // Parse spine: ordered list of manifest ids
  const spineRe = /<itemref[^>]+>/gi;
  let order = 0;
  while ((match = spineRe.exec(opfText)) !== null) {
    const itemrefXml = match[0];
    const idrefMatch = itemrefXml.match(/idref=["']([^"']+)["']/);
    if (idrefMatch) {
      const manifestId = idrefMatch[1];
      const href = itemMap.get(manifestId);
      if (href) {
        // Only include XHTML
        const fullHref = opfBase ? opfBase + '/' + href : href;
        if (href.endsWith('.xhtml') || href.endsWith('.html') || href.endsWith('.htm')) {
          chapters.push({
            id: manifestId,
            href: fullHref,
            title: `Kapitel ${order + 1}`,
            order: order++,
          });
        }
      }
    }
  }

  return { chapters, coverHref };
}

/** Extract title/author from OPF metadata */
function parseMeta(opfText: string): { title: string; author: string } {
  let title = 'Unbekannter Titel';
  let author = 'Unbekannter Autor';

  const titleMatch = opfText.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)
    ?? opfText.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) title = titleMatch[1].trim();

  const authorMatch = opfText.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i)
    ?? opfText.match(/<creator[^>]*>([^<]+)<\/creator>/i);
  if (authorMatch) author = authorMatch[1].trim();

  return { title, author };
}

/** Main EPUB extraction function */
export async function extractEpub(file: File): Promise<EpubMeta> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Find container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('Ungültiges EPUB: container.xml fehlt');

  // 2. Find rootfile path from container.xml
  const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/);
  if (!rootfileMatch) throw new Error('Ungültiges EPUB: Rootfile nicht gefunden');
  const opfPath = rootfileMatch[1];

  // 3. Read and parse the OPF
  const opfText = await zip.file(opfPath)?.async('string');
  if (!opfText) throw new Error('Ungültiges EPUB: OPF-Datei nicht gefunden');

  const opfBase = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';
  const { title, author } = parseMeta(opfText);
  const { chapters, coverHref } = parseOpf(opfText, opfBase);

  if (chapters.length === 0) throw new Error('Keine Kapitel im EPUB gefunden');

  // 4. Extract text from each chapter in order
  const textParts: string[] = [];
  for (const chapter of chapters) {
    const chapterFile = zip.file(chapter.href);
    if (!chapterFile) continue;

    const html = await chapterFile.async('string');

    // Try to extract chapter title from XHTML title element
    const chapterTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      ?? html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
      ?? html.match(/<span[^>]+class=["'][^"']*title[^"']*["'][^>]*>([^<]+)<\/span>/i);
    if (chapterTitleMatch) {
      chapter.title = chapterTitleMatch[1].trim().substring(0, 100);
    }

    const text = extractTextFromXhtml(html);
    if (text.trim()) {
      textParts.push(`\n\n## ${chapter.title}\n\n${text}`);
    }
  }

  const content = textParts.join('');

  if (!content.trim()) {
    throw new Error('EPUB enthält keinen extrahierbaren Text');
  }

  return { title, author, coverHref, chapters, content };
}
