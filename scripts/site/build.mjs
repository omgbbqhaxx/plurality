// Static site builder for the reading edition of the book.
//
// Renders contents/<directory>/*.md into standalone HTML pages that GitHub Pages
// can serve directly. Every link it emits is relative, so the output works
// unchanged whether it is published at a domain root or under a project path
// like /plurality/ — there is no base path to configure.
//
// Kept as plain ESM for the same reason locales.mjs is: it runs under both bun
// and node without a build step.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, basename } from 'node:path'
import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import { LOCALES, getLocale } from '../book/locales.mjs'

const markdown = MarkdownIt({ html: true, linkify: true, breaks: false })
markdown.use(footnote)

/** Chapters are the numbered files; anything else in the directory is ignored. */
const CHAPTER_PATTERN = /^[0-7].*\.md$/

/** Leading number of a chapter file, which selects its section heading. */
const sectionOf = (file) => Number(basename(file).match(/^(\d+)/)?.[1] ?? 0)

/**
 * URL-safe stem for a chapter file. Non-ASCII characters (the ⿻ glyph, Turkish
 * and Mandarin letters) are dropped rather than escaped so the published URLs
 * stay copy-pasteable; the numeric prefix keeps them unique.
 */
function slugify(file) {
  const stem = basename(file, '.md')
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || stem.replace(/[^0-9-]/g, '') || 'chapter'
}

/**
 * Readable title for a chapter that has no H1 — the "about the authors" pages
 * open with a figure instead. Any diacritics the filename dropped stay dropped;
 * this is a fallback, not a translation.
 */
function humanize(file) {
  const words = basename(file, '.md').replace(/^[\d-]+/, '').replace(/[-_]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : basename(file, '.md')
}

const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Split a chapter into its title and body. The leading H1 becomes the page
 * title, so it is removed from the body to avoid rendering it twice.
 */
function readChapter(path, fallbackTitle) {
  const raw = readFileSync(path, 'utf8')
  const match = raw.match(/^\s*#\s+(.+?)\s*$/m)
  const title = match ? match[1].trim() : fallbackTitle
  const body = match ? raw.replace(match[0], '') : raw
  return { title, html: markdown.render(body) }
}

function collectChapters(root, locale) {
  const config = getLocale(locale)
  const source = join(root, 'contents', config.directory)
  return readdirSync(source)
    .filter((name) => CHAPTER_PATTERN.test(name))
    .sort()
    .map((name) => {
      const chapter = readChapter(join(source, name), humanize(name))
      return { ...chapter, slug: slugify(name), section: sectionOf(name) }
    })
}

const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #fdfdfb;
  --fg: #22201d;
  --muted: #6b665f;
  --rule: #e2ded6;
  --link: #1c5d99;
  --accent: #7a4f9e;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16181c;
    --fg: #e6e3dd;
    --muted: #9a948b;
    --rule: #2e3238;
    --link: #79b8e8;
    --accent: #c4a2e8;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif", serif;
  font-size: 19px;
  line-height: 1.7;
  -webkit-text-size-adjust: 100%;
}
body[lang="zh-TW"] {
  font-family: "Noto Serif TC", "PingFang TC", "Songti TC", Georgia, serif;
}
.wrap { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 5rem; }
a { color: var(--link); }
a:hover { text-decoration: none; }
hr { border: 0; border-top: 1px solid var(--rule); margin: 2.5rem 0; }
h1 { font-size: 1.9rem; line-height: 1.25; margin: 0 0 1.5rem; }
h2 { font-size: 1.4rem; line-height: 1.3; margin: 2.5rem 0 1rem; }
h3 { font-size: 1.15rem; margin: 2rem 0 .75rem; }
blockquote {
  margin: 1.75rem 0;
  padding: .25rem 0 .25rem 1.25rem;
  border-left: 3px solid var(--accent);
  color: var(--muted);
  font-style: italic;
}
img { max-width: 100%; height: auto; display: block; margin: 1.75rem auto; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
.table-scroll { overflow-x: auto; margin: 1.75rem 0; }
table { border-collapse: collapse; width: 100%; font-size: .9rem; }
th, td { border: 1px solid var(--rule); padding: .5rem .7rem; text-align: left; vertical-align: top; }
.masthead {
  display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: baseline;
  border-bottom: 1px solid var(--rule); padding-bottom: .9rem; margin-bottom: 2.5rem;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: .85rem;
}
.masthead a { text-decoration: none; }
.masthead .spacer { margin-left: auto; }
.masthead .langs { color: var(--muted); }
.masthead .langs a { margin-left: .55rem; }
.masthead .langs .current { color: var(--fg); font-weight: 600; }
.byline { color: var(--muted); font-size: .95rem; margin: -1rem 0 2.5rem; }
.section-heading {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: .78rem; letter-spacing: .09em; text-transform: uppercase;
  color: var(--muted); margin: 2.5rem 0 .75rem;
}
.toc { list-style: none; padding: 0; margin: 0; }
.toc li { border-bottom: 1px solid var(--rule); }
.toc a { display: block; padding: .7rem .25rem; text-decoration: none; }
.toc a:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.pager {
  display: flex; gap: 1rem; justify-content: space-between;
  margin-top: 4rem; padding-top: 1.25rem; border-top: 1px solid var(--rule);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: .9rem;
}
.pager a { text-decoration: none; max-width: 45%; }
.pager .next { margin-left: auto; text-align: right; }
.footnotes { margin-top: 3.5rem; padding-top: 1.25rem; border-top: 1px solid var(--rule); font-size: .88rem; color: var(--muted); }
.footnotes ol { padding-left: 1.25rem; }
.editions { list-style: none; padding: 0; margin: 2.5rem 0 0; }
.editions li { border-top: 1px solid var(--rule); }
.editions li:last-child { border-bottom: 1px solid var(--rule); }
.editions a { display: block; padding: 1.1rem .25rem; text-decoration: none; }
.editions .name { font-size: 1.25rem; }
.editions .meta { display: block; color: var(--muted); font-size: .85rem; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
`

function page({ lang, title, styleHref, body }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${styleHref}">
</head>
<body lang="${lang}">
<div class="wrap">
${body}
</div>
</body>
</html>
`
}

/** Language strip shown on every page; `depth` is how far the page sits from the site root. */
function languageStrip(current, depth) {
  const up = depth === 0 ? './' : '../'
  const links = LOCALES.map((locale) => {
    const label = escapeHtml(getLocale(locale).title)
    if (locale === current) return `<span class="current">${label}</span>`
    return `<a href="${up}${encodeURIComponent(locale)}/">${label}</a>`
  }).join('')
  return `<span class="langs">${links}</span>`
}

/** markdown-it emits bare tables; wrap them so wide ones scroll instead of the page. */
const wrapTables = (html) => html.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>')

function renderLocale(root, outputRoot, locale) {
  const config = getLocale(locale)
  const chapters = collectChapters(root, locale)
  if (chapters.length === 0) throw new Error(`No chapters found for locale ${locale}`)
  const dir = join(outputRoot, locale)
  mkdirSync(dir, { recursive: true })

  // Group the chapters into runs that share a section, so each run can be
  // preceded by its translated heading. Front matter (the 0-* files) has no
  // label in the locale registry and is listed as an unheaded first run.
  const groups = []
  for (const chapter of chapters) {
    const label = chapter.section === 0 ? null : (config.sections[chapter.section] ?? null)
    const current = groups[groups.length - 1]
    if (current && current.label === label) current.chapters.push(chapter)
    else groups.push({ label, chapters: [chapter] })
  }

  const toc = groups
    .map(({ label, chapters: entries }) => {
      const heading = label ? `<p class="section-heading">${escapeHtml(label)}</p>\n` : ''
      const items = entries
        .map((chapter) => `<li><a href="./${chapter.slug}.html">${escapeHtml(chapter.title)}</a></li>`)
        .join('\n')
      return `${heading}<ul class="toc">\n${items}\n</ul>`
    })
    .join('\n')

  writeFileSync(
    join(dir, 'index.html'),
    page({
      lang: config.language,
      title: config.title,
      styleHref: '../assets/style.css',
      body: `<nav class="masthead"><a href="../">${escapeHtml(config.title)}</a><span class="spacer"></span>${languageStrip(locale, 1)}</nav>
<h1>${escapeHtml(config.title)}</h1>
<p class="byline">${escapeHtml(config.author)}</p>
${toc}`,
    }),
  )

  chapters.forEach((chapter, index) => {
    const previous = chapters[index - 1]
    const next = chapters[index + 1]
    const pager = [
      previous ? `<a class="prev" href="./${previous.slug}.html">← ${escapeHtml(previous.title)}</a>` : '',
      next ? `<a class="next" href="./${next.slug}.html">${escapeHtml(next.title)} →</a>` : '',
    ].join('\n')
    writeFileSync(
      join(dir, `${chapter.slug}.html`),
      page({
        lang: config.language,
        title: `${chapter.title} — ${config.title}`,
        styleHref: '../assets/style.css',
        body: `<nav class="masthead"><a href="./">${escapeHtml(config.title)}</a><span class="spacer"></span>${languageStrip(locale, 1)}</nav>
<h1>${escapeHtml(chapter.title)}</h1>
${wrapTables(chapter.html)}
<nav class="pager">
${pager}
</nav>`,
      }),
    )
  })

  return chapters.length
}

function renderHome(outputRoot) {
  const editions = LOCALES.map((locale) => {
    const config = getLocale(locale)
    return `<li><a href="./${encodeURIComponent(locale)}/">
<span class="name" lang="${config.language}">${escapeHtml(config.title)}</span>
<span class="meta">${escapeHtml(config.author)}</span>
</a></li>`
  }).join('\n')

  writeFileSync(
    join(outputRoot, 'index.html'),
    page({
      lang: 'en',
      title: 'Plurality',
      styleHref: './assets/style.css',
      body: `<h1>Plurality</h1>
<p class="byline">The Future of Collaborative Technology and Democracy</p>
<ul class="editions">
${editions}
</ul>`,
    }),
  )
}

export function buildSite(root, outputRoot) {
  rmSync(outputRoot, { recursive: true, force: true })
  mkdirSync(join(outputRoot, 'assets'), { recursive: true })
  writeFileSync(join(outputRoot, 'assets', 'style.css'), STYLES)
  // GitHub Pages runs Jekyll over uploaded files unless told not to, which would
  // strip the assets directory and anything else it considers private.
  writeFileSync(join(outputRoot, '.nojekyll'), '')

  const counts = {}
  for (const locale of LOCALES) counts[locale] = renderLocale(root, outputRoot, locale)
  renderHome(outputRoot)
  return counts
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('build.mjs')
if (invokedDirectly) {
  const outputRoot = process.argv[2]
  if (!outputRoot) throw new Error('Usage: node scripts/site/build.mjs OUTPUT_DIR')
  const counts = buildSite(process.cwd(), outputRoot)
  for (const locale of LOCALES) console.log(`${locale}: ${counts[locale]} chapters`)
  console.log(`Site written to ${outputRoot}`)
}
