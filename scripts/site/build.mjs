// Static site builder for the reading edition of the book.
//
// Renders contents/<directory>/*.md into standalone HTML pages that GitHub Pages
// can serve directly. Every link it emits is relative, so the output works
// unchanged whether it is published at a domain root or under a project path
// like /plurality/ — there is no base path to configure.
//
// The look follows the reading experience at plurality.net/read: a fixed top
// bar, a sticky table of contents beside a "book page" card, book-quality
// typography with a drop cap, and colour-coded chapter cards on the index.
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

/** Chapter number as printed on the page: "0-1", "1", "2-0"… */
const numberOf = (file) => basename(file).match(/^(\d+(?:-\d+)?)/)?.[1] ?? '0'

/** Repository the figures are served from; the source links there directly. */
const GITHUB_URL = 'https://github.com/pluralitybook/plurality'

/**
 * Interface strings that are not in the locale registry because they only
 * exist on the website. Anything missing falls back to English.
 */
const UI = {
  en: {
    read: 'Read',
    theBook: 'The Book',
    intro: 'Browse chapters by section. The book is available in multiple languages and is being continuously translated by a community of volunteers.',
    contents: 'Table of Contents',
    beforeYouRead: 'Before You Read',
    previous: 'Previous',
    next: 'Next',
    language: 'Language',
    theme: 'Toggle theme',
    skip: 'Skip to content',
    license: 'This work is dedicated to the public domain under CC0.',
    subtitle: 'The Future of Collaborative Technology and Democracy',
    editions: 'Editions',
  },
  tr: {
    read: 'Oku',
    theBook: 'Kitap',
    intro: 'Bölümlere kısımlara göre göz atın. Kitap birden çok dilde mevcuttur ve gönüllülerden oluşan bir topluluk tarafından sürekli olarak çevrilmektedir.',
    contents: 'İçindekiler',
    beforeYouRead: 'Okumadan Önce',
    previous: 'Önceki',
    next: 'Sonraki',
    language: 'Dil',
    theme: 'Temayı değiştir',
    skip: 'İçeriğe atla',
    license: 'Bu eser CC0 ile kamu malı olarak sunulmuştur.',
    subtitle: 'İşbirliğine Dayalı Teknolojinin ve Demokrasinin Geleceği',
    editions: 'Sürümler',
  },
  'zh-TW': {
    read: '閱讀',
    theBook: '本書',
    intro: '依章節瀏覽。本書提供多種語言版本，並由志工社群持續翻譯中。',
    contents: '目錄',
    beforeYouRead: '閱讀之前',
    previous: '上一章',
    next: '下一章',
    language: '語言',
    theme: '切換主題',
    skip: '跳至內容',
    license: '本作品以 CC0 授權釋出至公眾領域。',
    subtitle: '協作技術與民主的未來',
    editions: '版本',
  },
}

const ui = (locale) => ({ ...UI.en, ...(UI[locale] ?? {}) })

/** Titles for chapters whose source has no H1 (they open with a figure). */
const TITLE_FALLBACKS = {
  en: { '0-1': 'About the Authors' },
  tr: { '0-1': 'Yazarlar Hakkında' },
  'zh-TW': { '0-1': '關於作者群' },
}

/** Brand colours cycle through the sections, as on the original site. */
const SECTION_COLOURS = ['red', 'orange', 'green', 'cyan']
const colourOf = (section) => `var(--plurality-${SECTION_COLOURS[section % SECTION_COLOURS.length]})`

/**
 * The registry labels sections for the printed book ("Section 2: Introduction",
 * "Kısım 2: Giriş", "二、導論"). On the website only the name is shown.
 */
function shortSectionLabel(locale, section) {
  if (section === 0) return ui(locale).beforeYouRead
  const label = getLocale(locale).sections[section] ?? ''
  return label.replace(/^(?:Section|Kısım)\s*\d+\s*[:：]\s*/i, '').replace(/^[一二三四五六七八九十]+、\s*/, '')
}

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
      const fallback = TITLE_FALLBACKS[locale]?.[numberOf(name)] ?? humanize(name)
      const chapter = readChapter(join(source, name), fallback)
      return { ...chapter, slug: slugify(name), section: sectionOf(name), number: numberOf(name) }
    })
}

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:wght@400;700&family=Outfit:wght@300;400;500;600&family=Noto+Serif+TC:wght@400;700&family=Noto+Sans+TC:wght@400;500;700&display=swap'

const STYLES = `/* Design tokens */
:root {
  --ink: #0f1923;
  --paper: #faf8f5;
  --warm: #f4f1ec;
  --surface: #ffffff;
  --text: #1a2a3a;
  --muted: #4a5568;
  --heading: #0f1923;
  --gold: #7d6430;
  --gold-light: #c9a961;
  --teal: #2a7f8a;
  --border: #e0ddd7;
  --plurality-red: #D64933;
  --plurality-orange: #FBB03B;
  --plurality-green: #39B54A;
  --plurality-cyan: #0EB1D2;
  --serif: 'Lora', Georgia, serif;
  --display-serif: 'Cormorant Garamond', Georgia, serif;
  --sans: 'Outfit', system-ui, sans-serif;
  --content-max: 1200px;
  --reading-max: 720px;
  --pad-h: clamp(24px, 5vw, 80px);
  --radius: 4px;
  --shadow-md: 0 8px 32px rgba(0, 0, 0, 0.08);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --nav-height: 72px;
  --nav-bg: rgba(250, 248, 245, 0.96);
  color-scheme: light;
}
:root[data-theme="dark"] {
  --ink: #080d12;
  --paper: #111820;
  --warm: #161e28;
  --surface: #1c2535;
  --text: #d4d0c8;
  --muted: #9ca8b8;
  --heading: #e8e4dc;
  --gold: #c9a961;
  --gold-light: #ddc07a;
  --teal: #4bc3d4;
  --border: rgba(255, 255, 255, 0.1);
  --nav-bg: rgba(17, 24, 32, 0.96);
  --shadow-md: 0 8px 32px rgba(0, 0, 0, 0.3);
  color-scheme: dark;
}
:lang(zh) {
  --serif: 'Noto Serif TC', 'Source Han Serif TC', 'Songti TC', Georgia, serif;
  --display-serif: 'Noto Serif TC', 'Songti TC', Georgia, serif;
  --sans: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', system-ui, sans-serif;
  font-synthesis: none;
}

/* Base */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; scroll-padding-top: 90px; -webkit-text-size-adjust: 100%; }
body {
  font-family: var(--sans);
  line-height: 1.7;
  color: var(--text);
  background: var(--paper);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}
h1, h2, h3, h4 { font-family: var(--display-serif); color: var(--heading); font-weight: 400; line-height: 1.25; }
h1 { font-size: clamp(2.5rem, 5vw, 4rem); }
h2 { font-size: clamp(2rem, 3.5vw, 2.8rem); letter-spacing: -0.01em; }
h3 { font-size: 1.35rem; font-weight: 600; }
p { margin-bottom: 1.2em; }
a {
  color: var(--teal);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  text-decoration-color: color-mix(in srgb, var(--teal) 35%, transparent);
  transition: color 0.2s;
}
a:hover { color: var(--gold); }
:focus-visible { outline: 2px solid var(--teal); outline-offset: 3px; }
::selection { background: color-mix(in srgb, var(--teal) 20%, transparent); }
ul, ol { padding-left: 1.5em; }
li { margin-bottom: 0.4em; line-height: 1.7; }
img { max-width: 100%; height: auto; display: block; }
hr { border: none; height: 1px; background: linear-gradient(90deg, transparent, var(--gold-light), transparent); margin: 3em 0; }
blockquote {
  border-left: 2px solid var(--gold);
  padding-left: 24px;
  margin: 2em 0;
  font-family: var(--serif);
  font-style: italic;
  font-size: 1.15rem;
  color: var(--muted);
}
blockquote:lang(zh), em:lang(zh) { font-style: normal; }
.skip-link {
  position: absolute; top: -100%; left: 16px; z-index: 9999;
  padding: 8px 16px; background: var(--ink); color: #fff;
  font-size: 0.85rem; border-radius: 0 0 var(--radius) var(--radius); text-decoration: none;
}
.skip-link:focus { top: 0; }
.section-label {
  font-family: var(--sans); font-size: 0.7rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.2em; color: var(--gold); margin-bottom: 1rem;
}
:lang(zh) .section-label, :lang(zh) .book__section-label, :lang(zh) .book__toc-heading,
:lang(zh) .book__toc-section, :lang(zh) .chapter-group__title, :lang(zh) .book__nav-label { letter-spacing: 0.1em; }

/* Navigation */
.nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  height: var(--nav-height); display: flex; align-items: center;
  padding: 0 var(--pad-h);
  background: var(--nav-bg);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
.nav.scrolled { border-bottom-color: var(--border); box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06); }
.nav__inner { display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: var(--content-max); margin: 0 auto; }
.nav__logo { font-family: var(--serif); font-size: 1.3rem; font-weight: 700; color: var(--heading); text-decoration: none; letter-spacing: -0.01em; }
.nav__logo:hover { color: var(--gold); }
.nav__links { display: flex; align-items: center; gap: 28px; list-style: none; padding: 0; margin: 0; }
.nav__links li { margin: 0; }
.nav__link { font-family: var(--sans); font-size: 0.85rem; font-weight: 500; color: var(--text); text-decoration: none; }
.nav__link:hover { color: var(--teal); }
.nav__link--active { color: var(--gold); }
.theme-toggle {
  display: inline-flex; align-items: center; background: none; border: 1px solid var(--border);
  border-radius: var(--radius); padding: 6px 12px; color: var(--text); cursor: pointer;
  transition: all 0.2s;
}
.theme-toggle:hover { border-color: var(--gold-light); color: var(--gold); }
.theme-icon--sun { display: none; }
:root[data-theme="dark"] .theme-icon--moon { display: none; }
:root[data-theme="dark"] .theme-icon--sun { display: inline; }
@media (max-width: 600px) { .nav__links { gap: 16px; } }

/* Language switch */
.lang-bar { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; font-family: var(--sans); font-size: 0.78rem; }
.lang-bar__current { color: var(--heading); font-weight: 600; padding: 3px 10px; background: var(--warm); border-radius: var(--radius); }
.lang-bar__link { color: var(--teal); text-decoration: none; padding: 3px 10px; border: 1px solid var(--border); border-radius: var(--radius); transition: border-color 0.2s, background 0.2s; }
.lang-bar__link:hover { border-color: var(--teal); background: var(--warm); }
.lang-bar--missing { opacity: 0.45; }

/* Read index */
.read-page { max-width: var(--content-max); margin: 0 auto; padding: calc(var(--nav-height) + 60px) var(--pad-h) 80px; }
.read-page h1 { margin-bottom: 0.5rem; }
.read-page__intro { font-size: 1.05rem; color: var(--muted); margin-bottom: 1.5rem; max-width: 60ch; }
.read-page .lang-bar { justify-content: flex-start; margin-bottom: 2.5rem; }
.chapter-group { margin-bottom: 3rem; }
.chapter-group__title {
  font-family: var(--sans); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em;
  color: var(--heading); padding-bottom: 8px; margin-bottom: 16px; border-bottom: 2px solid var(--border);
  display: flex; align-items: center; gap: 12px;
}
.chapter-group__accent { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
.chapter-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.chapter-card {
  display: block; background: var(--surface); border: 1px solid var(--border); border-top: 3px solid var(--border);
  border-radius: var(--radius); padding: 24px; text-decoration: none;
  transition: transform 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out);
}
.chapter-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.chapter-card__number { display: block; font-family: var(--display-serif); font-size: 2rem; font-weight: 300; color: var(--gold); line-height: 1; margin-bottom: 8px; }
.chapter-card__title { display: block; font-family: var(--serif); font-size: 1.15rem; font-weight: 600; color: var(--heading); }

/* Book reader */
.book { display: flex; max-width: var(--content-max); margin: 0 auto; padding: calc(var(--nav-height) + 32px) 24px 60px; min-height: 100vh; }
.book__toc {
  position: sticky; top: calc(var(--nav-height) + 32px); width: 230px; min-width: 230px;
  max-height: calc(100vh - var(--nav-height) - 64px); overflow-y: auto; align-self: flex-start;
  padding-right: 24px; scrollbar-width: thin; scrollbar-color: var(--border) transparent;
}
.book__toc-toggle {
  display: none; width: 100%; padding: 12px 16px; background: var(--warm); border: 1px solid var(--border);
  border-radius: var(--radius); font-family: var(--sans); font-size: 0.85rem; font-weight: 500; color: var(--heading);
  cursor: pointer; text-align: left; align-items: center; gap: 10px;
}
.book__toc-toggle-icon { display: inline-block; width: 16px; height: 12px; position: relative; }
.book__toc-toggle-icon::before, .book__toc-toggle-icon::after { content: ''; position: absolute; left: 0; right: 0; height: 2px; background: var(--muted); border-radius: 1px; }
.book__toc-toggle-icon::before { top: 0; }
.book__toc-toggle-icon::after { top: 5px; }
.book__toc-heading { font-family: var(--sans); font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em; color: var(--gold); margin-bottom: 16px; }
.book__toc-section { font-family: var(--sans); font-size: 0.62rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; color: var(--gold); margin: 14px 0 4px; padding-left: 14px; }
.book__toc-section:first-of-type { margin-top: 0; }
.book__toc-list { list-style: none; padding: 0; }
.book__toc-list li { margin: 0; }
.book__toc-list a {
  display: block; padding: 3px 0 3px 14px; font-family: var(--sans); font-size: 0.78rem; line-height: 1.35;
  color: var(--muted); text-decoration: none; border-left: 2px solid transparent; transition: color 0.2s, border-color 0.2s;
}
.book__toc-num { color: var(--gold-light); font-size: 0.7rem; margin-right: 2px; }
.book__toc-list a:hover, .book__toc-list a.active { color: var(--teal); border-left-color: var(--teal); }

.book__page {
  flex: 1; width: 100%; min-width: 0; max-width: var(--reading-max); margin: 0 auto; position: relative; overflow-x: hidden;
  background: var(--surface); border: 1px solid var(--border); border-radius: 2px 6px 6px 2px; padding: 56px 56px 48px;
  box-shadow:
    -4px 0 8px rgba(0, 0, 0, 0.04),
    2px 0 0 var(--border),
    4px 0 0 color-mix(in srgb, var(--surface) 90%, var(--border)),
    5px 0 0 var(--border),
    7px 0 0 color-mix(in srgb, var(--surface) 85%, var(--border)),
    8px 0 0 var(--border),
    12px 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04);
}
:root[data-theme="dark"] .book__page {
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15), 2px 0 0 var(--border), 4px 0 0 color-mix(in srgb, var(--surface) 90%, var(--border)),
    5px 0 0 var(--border), 12px 8px 40px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.12);
}
.book__page-curl {
  position: absolute; bottom: 0; right: 0; width: 24px; height: 24px; pointer-events: none; opacity: 0.5;
  background: linear-gradient(-135deg, var(--warm) 0%, var(--warm) 42%, var(--border) 44%, var(--surface) 46%, var(--surface) 100%);
  border-radius: 0 0 6px 0;
}
.book__header { margin-bottom: 3rem; padding-bottom: 2rem; text-align: center; }
.book__section-label { font-family: var(--sans); font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.25em; color: var(--gold); margin-bottom: 1rem; }
.book__title { font-family: var(--display-serif); font-size: clamp(2rem, 4.5vw, 2.8rem); font-weight: 400; line-height: 1.2; color: var(--heading); margin-bottom: 0.75rem; }
.book__header .lang-bar { margin-top: 14px; }
.book__header-ornament { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 2rem; }
.book__header-ornament span { display: block; width: 4px; height: 4px; background: var(--gold-light); border-radius: 1px; transform: rotate(45deg); }
.book__header-ornament span:nth-child(2) { width: 6px; height: 6px; }

.book__body {
  font-family: var(--serif); font-size: 1.12rem; line-height: 1.85; color: var(--text);
  text-align: justify; hyphens: auto; -webkit-hyphens: auto; overflow-wrap: break-word; word-break: break-word;
}
.book__body:lang(zh) { hyphens: none; line-break: strict; word-break: normal; }
.book__body--dropcap > p:first-of-type::first-letter {
  float: left; font-family: var(--display-serif); font-size: 3.6em; line-height: 0.8;
  padding-right: 10px; padding-top: 6px; color: var(--gold);
}
.book__body h2 { font-size: clamp(1.5rem, 3vw, 1.9rem); margin: 2em 0 0.6em; padding-bottom: 10px; text-align: left; border-bottom: 1px solid var(--gold-light); }
.book__body h3 { font-size: 1.3rem; margin: 1.8em 0 0.5em; text-align: left; }
.book__body h4 { font-size: 1.05rem; margin: 1.4em 0 0.3em; text-align: left; }
.book__body p { margin: 0 0 0.3em; text-indent: 1.5em; }
.book__body > p:first-of-type, .book__body h2 + p, .book__body h3 + p, .book__body h4 + p,
.book__body blockquote + p, .book__body ul + p, .book__body ol + p, .book__body figure + p,
.book__body hr + p, .book__body .table-scroll + p { text-indent: 0; }
.book__body hr { margin: 1.5em 0; }
.book__body blockquote { margin: 1em 0 1em 1em; padding: 0.3em 0 0.3em 1.5em; font-size: inherit; text-align: left; }
.book__body blockquote p { text-indent: 0; margin-bottom: 0.4em; }
.book__body--endorsements blockquote { border-left: none; margin: 0.5em 0; padding-left: 0; }
.book__body img { border-radius: var(--radius); border: 1px solid var(--border); margin: 2em auto; }
.book__body figure { margin: 2em 0; text-align: center; }
.book__body figure img { margin: 0 auto 0.8em; }
.book__body figcaption { font-family: var(--sans); font-size: 0.85rem; color: var(--muted); text-align: center; line-height: 1.5; text-indent: 0; }
.book__body ul, .book__body ol { text-align: left; margin: 1em 0; }
.book__body li { text-indent: 0; }
.book__body code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.88em; }
.book__body pre { overflow-x: auto; background: var(--warm); padding: 1em; border-radius: var(--radius); margin: 1.5em 0; text-align: left; }
.table-scroll { overflow-x: auto; margin: 1.5em 0; }
.book__body table { border-collapse: collapse; width: 100%; font-family: var(--sans); font-size: 0.85rem; text-align: left; }
.book__body th, .book__body td { border: 1px solid var(--border); padding: 0.5em 0.7em; vertical-align: top; }
.book__body th { background: var(--warm); }
.book__body sup { line-height: 0; }
.footnote-ref a { text-decoration: none; font-family: var(--sans); font-size: 0.75em; }
.book__body .footnotes { margin-top: 4em; padding-top: 2em; border-top: 1px solid var(--border); font-size: 0.88rem; line-height: 1.6; text-align: left; overflow-wrap: anywhere; }
.book__body .footnotes-sep { display: none; }
.book__body .footnotes ol { padding-left: 1.5em; }
.book__body .footnotes p { text-indent: 0; margin-bottom: 0.5em; }
.footnote-backref { text-decoration: none; }

.book__nav { display: flex; justify-content: space-between; align-items: stretch; margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border); gap: 16px; }
.book__nav-link {
  display: flex; align-items: center; gap: 16px; padding: 20px 24px; background: var(--warm); border: 1px solid var(--border);
  border-radius: var(--radius); text-decoration: none; transition: all 0.3s var(--ease-out); max-width: 48%;
}
.book__nav-link:hover { border-color: var(--gold-light); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); transform: translateY(-1px); }
.book__nav-link--next { margin-left: auto; text-align: right; }
.book__nav-arrow { font-size: 1.5rem; color: var(--gold); line-height: 1; flex-shrink: 0; transition: transform 0.3s var(--ease-out); }
.book__nav-link--prev:hover .book__nav-arrow { transform: translateX(-4px); }
.book__nav-link--next:hover .book__nav-arrow { transform: translateX(4px); }
.book__nav-info { display: flex; flex-direction: column; gap: 2px; }
.book__nav-label { font-family: var(--sans); font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; color: var(--muted); }
.book__nav-title { font-family: var(--serif); font-size: 0.95rem; color: var(--heading); line-height: 1.3; }
.book__page-number { text-align: center; margin-top: 3rem; font-family: var(--serif); font-size: 0.85rem; color: var(--muted); letter-spacing: 0.05em; opacity: 0.6; }

/* Landing page */
.home { max-width: var(--content-max); margin: 0 auto; padding: calc(var(--nav-height) + 80px) var(--pad-h) 100px; text-align: center; }
.home__glyph { font-family: var(--serif); font-size: clamp(4rem, 12vw, 7rem); line-height: 1; color: var(--gold-light); margin-bottom: 1rem; }
.home__title { font-size: clamp(2.8rem, 6vw, 4.5rem); }
.home__title .c-r { color: var(--plurality-red); }
.home__title .c-o { color: var(--plurality-orange); }
.home__title .c-g { color: var(--plurality-green); }
.home__title .c-c { color: var(--plurality-cyan); }
.home__title .c-h { color: var(--heading); }
.home__subtitle { font-family: var(--serif); font-style: italic; font-size: 1.3rem; color: var(--muted); margin: 0.5rem auto 0.5rem; max-width: 40ch; }
.home__authors { font-family: var(--sans); font-size: 0.9rem; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 3rem; }
.edition-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; max-width: 900px; margin: 1rem auto 0; text-align: left; }
.edition-card {
  display: block; background: var(--surface); border: 1px solid var(--border); border-top: 3px solid var(--gold-light);
  border-radius: var(--radius); padding: 28px 24px; text-decoration: none; transition: transform 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out);
}
.edition-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.edition-card__title { display: block; font-family: var(--display-serif); font-size: 1.9rem; color: var(--heading); line-height: 1.1; margin-bottom: 6px; }
.edition-card__subtitle { display: block; font-family: var(--serif); font-size: 0.95rem; color: var(--text); margin-bottom: 10px; }
.edition-card__meta { display: block; font-family: var(--sans); font-size: 0.75rem; color: var(--muted); letter-spacing: 0.04em; }

/* Footer */
.footer { background: var(--ink); padding: 60px var(--pad-h); text-align: center; }
.footer__brand { font-family: var(--serif); font-size: 1.5rem; margin-bottom: 1.5rem; letter-spacing: 0.05em; }
.footer__brand .c-r { color: var(--plurality-red); }
.footer__brand .c-o { color: var(--plurality-orange); }
.footer__brand .c-g { color: var(--plurality-green); }
.footer__brand .c-c { color: var(--plurality-cyan); }
.footer__brand .c-w { color: #fff; }
.footer__links { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin-bottom: 2rem; list-style: none; padding: 0; }
.footer__links li { margin: 0; }
.footer__link { font-family: var(--sans); font-size: 0.85rem; color: var(--gold-light); text-decoration: none; }
.footer__link:hover { color: #fff; text-decoration: underline; }
.footer__sep { width: 120px; height: 1px; background: linear-gradient(90deg, transparent, var(--gold-light), transparent); margin: 0 auto 1.5rem; }
.footer__authors { font-family: var(--sans); font-size: 0.85rem; color: rgba(255, 255, 255, 0.5); margin-bottom: 0.5rem; }
.footer__license { font-family: var(--sans); font-size: 0.8rem; color: rgba(255, 255, 255, 0.35); }

/* Responsive */
@media (max-width: 1024px) {
  .book { flex-direction: column; padding: calc(var(--nav-height) + 16px) 16px 40px; }
  .book__toc { position: static; width: 100%; min-width: 0; max-height: none; padding-right: 0; margin-bottom: 16px; }
  .book__toc-toggle { display: flex; }
  .book__toc-nav { display: none; margin-top: 12px; padding: 16px; background: var(--warm); border-radius: var(--radius); }
  .book__toc.open .book__toc-nav { display: block; }
  .book__page { padding: 40px 32px 36px; border-radius: var(--radius); box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04); }
}
@media (max-width: 768px) {
  .book__page { padding: 32px 20px 28px; }
  .book__body { font-size: 1.05rem; text-align: left; hyphens: none; }
  .book__body p { text-indent: 0; margin-bottom: 1em; }
  .book__body--dropcap > p:first-of-type::first-letter { float: none; font-size: inherit; padding: 0; color: inherit; }
  .book__nav { flex-direction: column; }
  .book__nav-link { max-width: 100%; }
  .book__nav-link--next { text-align: left; flex-direction: row-reverse; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; }
  html { scroll-behavior: auto; }
}
@media print {
  .nav, .footer, .book__toc, .book__nav, .theme-toggle, .skip-link, .lang-bar { display: none !important; }
  body { background: #fff; color: #000; }
  .book { padding: 0; }
  .book__page { box-shadow: none; border: none; padding: 0; max-width: 100%; }
}
`

/** Applies the saved theme before first paint, so pages do not flash. */
const THEME_BOOT = `(function(){var t=null;try{t=localStorage.getItem("plurality-theme")}catch(e){}if(!t)t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)})();`

const SCRIPT = `(function () {
  var root = document.documentElement;
  function setTheme(theme, persist) {
    root.setAttribute("data-theme", theme);
    if (persist) { try { localStorage.setItem("plurality-theme", theme); } catch (e) {} }
  }
  document.querySelectorAll(".theme-toggle").forEach(function (button) {
    button.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
    });
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (event) {
    var stored = null;
    try { stored = localStorage.getItem("plurality-theme"); } catch (e) {}
    if (!stored) setTheme(event.matches ? "dark" : "light", false);
  });

  var nav = document.querySelector(".nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 10); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  var toggle = document.getElementById("toc-toggle");
  var toc = document.getElementById("book-toc");
  if (toggle && toc) {
    toggle.addEventListener("click", function () {
      var open = toc.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Keep the current chapter visible in the sidebar without moving the page.
  var active = document.querySelector(".book__toc-list a.active");
  if (active && toc && window.innerWidth > 1024) {
    toc.scrollTop = Math.max(0, active.offsetTop - toc.clientHeight / 2);
  }
})();
`

const THEME_ICONS = `<svg class="theme-icon theme-icon--moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg><svg class="theme-icon theme-icon--sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line></svg>`

const brand = (middle) =>
  `<span class="c-r">P</span><span class="c-o">l</span><span class="c-g">u</span><span class="c-c">r</span><span class="${middle}">a</span><span class="c-c">l</span><span class="c-g">i</span><span class="c-o">t</span><span class="c-r">y</span>`

/**
 * Shared page shell. `up` is the relative path from the page to the site root
 * ("./" at the root, "../" one level down), which every asset link is built on.
 */
function page({ lang, locale, title, description, up, body, readActive = true }) {
  const strings = ui(locale)
  const readHref = `${up}${encodeURIComponent(locale)}/`
  return `<!doctype html>
<html lang="${lang}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="theme-color" content="#faf8f5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111820" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONT_HREF}">
<link rel="stylesheet" href="${up}assets/style.css">
<script>${THEME_BOOT}</script>
</head>
<body>
<a href="#main" class="skip-link">${escapeHtml(strings.skip)}</a>
<nav class="nav" aria-label="Main navigation">
<div class="nav__inner">
<a href="${up}" class="nav__logo" lang="en">Plurality</a>
<ul class="nav__links">
<li><a href="${readHref}" class="nav__link${readActive ? ' nav__link--active' : ''}">${escapeHtml(strings.read)}</a></li>
<li><a href="${GITHUB_URL}" class="nav__link" target="_blank" rel="noopener">GitHub</a></li>
<li><button class="theme-toggle" type="button" aria-label="${escapeHtml(strings.theme)}">${THEME_ICONS}</button></li>
</ul>
</div>
</nav>
<main id="main">
${body}
</main>
<footer class="footer">
<div class="footer__brand" lang="en" aria-hidden="true">${brand('c-w')}</div>
<ul class="footer__links">
<li><a href="${readHref}" class="footer__link">${escapeHtml(strings.read)}</a></li>
<li><a href="${GITHUB_URL}" class="footer__link" target="_blank" rel="noopener">GitHub</a></li>
<li><a href="https://plurality.net" class="footer__link" target="_blank" rel="noopener">plurality.net</a></li>
</ul>
<div class="footer__sep"></div>
<p class="footer__authors">${escapeHtml(getLocale(locale).author)}</p>
<p class="footer__license">${escapeHtml(strings.license)}</p>
</footer>
<script src="${up}assets/site.js"></script>
</body>
</html>
`
}

/**
 * Language switch. On chapter pages it links to the same chapter number in the
 * other editions; on index pages to the other editions' indexes.
 */
function languageBar(site, current, number) {
  const strings = ui(current)
  const links = LOCALES.map((locale) => {
    const config = getLocale(locale)
    const label = escapeHtml(config.title)
    if (locale === current) return `<span class="lang-bar__current">${label}</span>`
    const base = `../${encodeURIComponent(locale)}/`
    if (!number) return `<a href="${base}" class="lang-bar__link" lang="${config.language}" hreflang="${config.language}">${label}</a>`
    const target = site[locale].byNumber.get(number)
    const href = target ? `${base}${target.slug}.html` : base
    const missing = target ? '' : ' lang-bar--missing'
    return `<a href="${href}" class="lang-bar__link${missing}" lang="${config.language}" hreflang="${config.language}">${label}</a>`
  }).join('')
  return `<nav class="lang-bar" aria-label="${escapeHtml(strings.language)}">${links}</nav>`
}

/** markdown-it emits bare tables; wrap them so wide ones scroll instead of the page. */
const wrapTables = (html) => html.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>')

/** Chapters grouped into runs that share a section, in reading order. */
function groupBySection(chapters) {
  const groups = []
  for (const chapter of chapters) {
    const current = groups[groups.length - 1]
    if (current && current.section === chapter.section) current.chapters.push(chapter)
    else groups.push({ section: chapter.section, chapters: [chapter] })
  }
  return groups
}

function renderIndex(site, outputRoot, locale) {
  const config = getLocale(locale)
  const strings = ui(locale)
  const { chapters } = site[locale]

  const groups = groupBySection(chapters)
    .map(({ section, chapters: entries }) => {
      const colour = colourOf(section)
      const cards = entries
        .map(
          (chapter) =>
            `<a href="./${chapter.slug}.html" class="chapter-card" style="border-top-color:${colour}"><span class="chapter-card__number">${escapeHtml(chapter.number)}</span><span class="chapter-card__title">${escapeHtml(chapter.title)}</span></a>`,
        )
        .join('\n')
      return `<section class="chapter-group">
<h3 class="chapter-group__title"><span class="chapter-group__accent" style="background:${colour}"></span>${escapeHtml(shortSectionLabel(locale, section))}</h3>
<div class="chapter-list">
${cards}
</div>
</section>`
    })
    .join('\n')

  writeFileSync(
    join(outputRoot, locale, 'index.html'),
    page({
      lang: config.language,
      locale,
      title: `${strings.read} — ${config.title}`,
      description: `${config.title}: ${strings.subtitle}. ${config.author}.`,
      up: '../',
      body: `<div class="read-page">
<p class="section-label">${escapeHtml(strings.theBook)}</p>
<h1>${escapeHtml(config.title)}: ${escapeHtml(strings.subtitle)}</h1>
<p class="read-page__intro">${escapeHtml(strings.intro)}</p>
${languageBar(site, locale)}
<div class="chapter-groups">
${groups}
</div>
</div>`,
    }),
  )
}

function renderChapter(site, outputRoot, locale, index) {
  const config = getLocale(locale)
  const strings = ui(locale)
  const { chapters } = site[locale]
  const chapter = chapters[index]
  const previous = chapters[index - 1]
  const next = chapters[index + 1]

  const toc = groupBySection(chapters)
    .map(({ section, chapters: entries }) => {
      const items = entries
        .map((entry) => {
          const active = entry === chapter ? ' class="active" aria-current="page"' : ''
          return `<li><a href="./${entry.slug}.html"${active}><span class="book__toc-num">${escapeHtml(entry.number)}</span> ${escapeHtml(entry.title)}</a></li>`
        })
        .join('')
      return `<p class="book__toc-section">${escapeHtml(shortSectionLabel(locale, section))}</p>\n<ul class="book__toc-list">${items}</ul>`
    })
    .join('\n')

  const navLinks = [
    previous
      ? `<a href="./${previous.slug}.html" class="book__nav-link book__nav-link--prev" rel="prev"><span class="book__nav-arrow">←</span><span class="book__nav-info"><span class="book__nav-label">${escapeHtml(strings.previous)}</span><span class="book__nav-title">${escapeHtml(previous.title)}</span></span></a>`
      : '',
    next
      ? `<a href="./${next.slug}.html" class="book__nav-link book__nav-link--next" rel="next"><span class="book__nav-info"><span class="book__nav-label">${escapeHtml(strings.next)}</span><span class="book__nav-title">${escapeHtml(next.title)}</span></span><span class="book__nav-arrow">→</span></a>`
      : '',
  ].join('\n')

  // CJK text has no first letter to enlarge; endorsements read better without
  // the quotation rule since the whole chapter is quotations.
  const bodyClasses = ['book__body']
  if (!config.language.startsWith('zh') && chapter.section > 0) bodyClasses.push('book__body--dropcap')
  if (chapter.number === '0-0') bodyClasses.push('book__body--endorsements')

  writeFileSync(
    join(outputRoot, locale, `${chapter.slug}.html`),
    page({
      lang: config.language,
      locale,
      title: `${chapter.title} — ${config.title}`,
      description: `${config.title}: ${strings.subtitle}. ${config.author}.`,
      up: '../',
      body: `<div class="book">
<aside class="book__toc" id="book-toc" aria-label="${escapeHtml(strings.contents)}">
<button class="book__toc-toggle" type="button" id="toc-toggle" aria-expanded="false"><span class="book__toc-toggle-icon"></span>${escapeHtml(strings.contents)}</button>
<nav class="book__toc-nav">
<p class="book__toc-heading">${escapeHtml(strings.contents)}</p>
${toc}
</nav>
</aside>
<article class="book__page">
<div class="book__page-curl" aria-hidden="true"></div>
<header class="book__header">
<p class="book__section-label">${escapeHtml(shortSectionLabel(locale, chapter.section))} · ${escapeHtml(chapter.number)}</p>
<h1 class="book__title">${escapeHtml(chapter.title)}</h1>
${languageBar(site, locale, chapter.number)}
<div class="book__header-ornament" aria-hidden="true"><span></span><span></span><span></span></div>
</header>
<div class="${bodyClasses.join(' ')}">
${wrapTables(chapter.html)}
</div>
<nav class="book__nav" aria-label="Chapter navigation">
${navLinks}
</nav>
<div class="book__page-number" aria-hidden="true">${escapeHtml(chapter.number)}</div>
</article>
</div>`,
    }),
  )
}

function renderLocale(site, outputRoot, locale) {
  mkdirSync(join(outputRoot, locale), { recursive: true })
  renderIndex(site, outputRoot, locale)
  site[locale].chapters.forEach((_, index) => renderChapter(site, outputRoot, locale, index))
  return site[locale].chapters.length
}

function renderHome(outputRoot) {
  const strings = ui('en')
  const editions = LOCALES.map((locale) => {
    const config = getLocale(locale)
    const localised = ui(locale)
    return `<a href="./${encodeURIComponent(locale)}/" class="edition-card" lang="${config.language}" hreflang="${config.language}">
<span class="edition-card__title">${escapeHtml(config.title)}</span>
<span class="edition-card__subtitle">${escapeHtml(localised.subtitle)}</span>
<span class="edition-card__meta">${escapeHtml(config.author)}</span>
</a>`
  }).join('\n')

  writeFileSync(
    join(outputRoot, 'index.html'),
    page({
      lang: 'en',
      locale: 'en',
      title: 'Plurality',
      description: `Plurality: ${strings.subtitle}. ${getLocale('en').author}.`,
      up: './',
      readActive: false,
      body: `<div class="home">
<div class="home__glyph" aria-hidden="true">⿻</div>
<h1 class="home__title" lang="en">${brand('c-h')}</h1>
<p class="home__subtitle">${escapeHtml(strings.subtitle)}</p>
<p class="home__authors">${escapeHtml(getLocale('en').author)}</p>
<p class="section-label">${escapeHtml(strings.editions)}</p>
<div class="edition-list">
${editions}
</div>
</div>`,
    }),
  )
}

export function buildSite(root, outputRoot) {
  rmSync(outputRoot, { recursive: true, force: true })
  mkdirSync(join(outputRoot, 'assets'), { recursive: true })
  writeFileSync(join(outputRoot, 'assets', 'style.css'), STYLES)
  writeFileSync(join(outputRoot, 'assets', 'site.js'), SCRIPT)
  // GitHub Pages runs Jekyll over uploaded files unless told not to, which would
  // strip the assets directory and anything else it considers private.
  writeFileSync(join(outputRoot, '.nojekyll'), '')

  // Every edition is read before any is written, so chapter pages can link to
  // the same chapter number in the other languages.
  const site = {}
  for (const locale of LOCALES) {
    const chapters = collectChapters(root, locale)
    if (chapters.length === 0) throw new Error(`No chapters found for locale ${locale}`)
    site[locale] = { chapters, byNumber: new Map(chapters.map((chapter) => [chapter.number, chapter])) }
  }

  const counts = {}
  for (const locale of LOCALES) counts[locale] = renderLocale(site, outputRoot, locale)
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
