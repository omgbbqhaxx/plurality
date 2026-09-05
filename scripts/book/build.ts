import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { writeManifest } from './manifest'
import { LOCALES, getLocale, isLocale } from './locales.mjs'
import type { Locale, LocaleDefinition } from './locales.d.mts'

export type { Locale }
type CreditContributor = { name: string; pt: number }
type CreditCategory = { name: string; contributors: CreditContributor[] }
type Credits = { categories: CreditCategory[]; i18n?: Record<string, { categories?: Record<string, string> }> }
type LocaleConfig = LocaleDefinition

const readUtf8 = (path: string): string => readFileSync(path, 'utf8')

export function validateCredits(value: unknown, locale: Locale = 'en'): Credits {
  if (!value || typeof value !== 'object') throw new Error('Invalid credits: expected an object')
  const credits = value as Partial<Credits>
  if (!Array.isArray(credits.categories)) throw new Error('Invalid credits: categories must be an array')
  const categories = credits.categories.map((category, index) => {
    if (!category || typeof category !== 'object' || typeof category.name !== 'string' || !Array.isArray(category.contributors)) throw new Error(`Invalid credits: category ${index}`)
    const contributors = category.contributors.map((contributor, contributorIndex) => {
      if (!contributor || typeof contributor !== 'object' || typeof contributor.name !== 'string' || typeof contributor.pt !== 'number' || !Number.isFinite(contributor.pt)) throw new Error(`Invalid credits: contributor ${index}.${contributorIndex}`)
      return { name: contributor.name, pt: contributor.pt }
    })
    return { name: category.name, contributors }
  })
  const localeKey = getLocale(locale).creditsKey
  const labels = credits.i18n?.[localeKey]?.categories
  if (!labels || typeof labels !== 'object') throw new Error(`Invalid credits: missing i18n.${localeKey}.categories`)
  return { categories, i18n: { [localeKey]: { categories: labels } } }
}

function markdownImgAlt(alt: string): string { return alt.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]') }
function imgTagToMarkdown(tag: string): string {
  const src = tag.match(/\bsrc="([^"]+)"/)?.[1] ?? tag.match(/\bsrc='([^']+)'/)?.[1]
  if (!src) return tag
  const alt = tag.match(/\balt="([^"]*)"/)?.[1] ?? tag.match(/\balt='([^']*)'/)?.[1] ?? 'figure'
  return `![${markdownImgAlt(alt)}](${src}){ width=100% }`
}

function transformChapter(path: string, headingBase: string, footnoteBase: string, config: LocaleConfig, isEndorsement: boolean): string {
  let content = readUtf8(path)
  if (isEndorsement) {
    content = content.replace(/^(.*\n){6}/, '').replace(/^> /gm, '---\n\n').replace(/^— /gm, '— ').replace(/\s*<br><\/br>\s*/g, '\n\n')
    content += '\n---\n'
    content = content.replace(/---\n\n/, '')
  }
  if (config.creditsKey === 'zh') content = content.replace(/(<(br|img)\b[^>]*)(?<!\/)\>/g, '$1 />')
  content = content.replace(/# /, `## ${headingBase} `).replace(/^( +|&nbsp;)+/gm, '')
  content = content.replace(/(\[\^)(.*?\])/g, `$1${footnoteBase}-$2`)
  content = content.replace(/!\[https?:\/\/[^\]]+\]\(([^)]+)\)(\{[^}]*\})?/g, `![figure]($1)$2`)
  content = content.replace(/!\[image\]\(([^)]+)\)/g, '![Gitcoin screenshot]($1)')
  content = content.replace(/!<br\s*\/?>\s*<\/br>!/g, '!')
  content = content.replace(/<img\b[^>]*>/g, (tag) => imgTagToMarkdown(tag))
  if (config.creditsKey === 'zh') {
    content = content.replace(/(^\s*\|?\s*(?:原文|作者|譯者)：.*\n)(^\s*\|?\s*(?:原文|作者|譯者)：.*\n|^\s*\n|^---\n)+/gm, '\n')
  }
  return content
}

function numberedPart(file: string): number { return Number(basename(file).match(/^(\d+)/)?.[1] ?? 0) }

export function assembleLocale(root: string, locale: Locale, bookDate: string, creditsValue: unknown): { markdown: string; preTex: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookDate)) throw new Error(`Invalid BOOK_DATE: ${bookDate}`)
  const config = getLocale(locale)
  const credits = validateCredits(creditsValue, locale)
  const labels = credits.i18n?.[config.creditsKey]?.categories ?? {}
  const source = join(root, 'contents', config.directory)
  let all = `---\n${config.metadata.replace('\nlang:', `\ndate: "${bookDate}"\nlang:`)}\n---\n`
  for (const name of (readdirSync(source) as string[]).filter((name: string) => /^0-[13]-.*\.md$/.test(name)).sort()) all += `${readUtf8(join(source, name)).replace(/^#+\s+(.+)/, '\n**$1**')}\n\n`
  let tex = '\n```{=latex}\n\\interfootnotelinepenalty=10000\n\\begin{center}\n\n'
  let html = '\n```{=html}\n<div style="text-align: center">\n'
  credits.categories.forEach((category, ci) => {
    const label = labels[category.name] ?? category.name
    tex += `\\textbf{${label}}\\\\[6pt]\n`
    category.contributors.forEach((contributor, ni) => { const baseline = (contributor.pt * 1.2).toFixed(1); const end = ni === category.contributors.length - 1 ? (ci < credits.categories.length - 1 ? '\\\\[16pt]' : '') : '\\\\'; tex += `{\\fontsize{${contributor.pt}pt}{${baseline}pt}\\selectfont ${contributor.name}${end}}\n` })
    html += ci > 0 ? `<p style="margin-top: 16pt"><strong>${label}</strong></p>\n` : `<p><strong>${label}</strong></p>\n`
    category.contributors.forEach((contributor) => { html += `<p style="font-size: ${contributor.pt}pt; margin: 2pt 0">${contributor.name}</p>\n` })
  })
  all += tex + '\n\\end{center}\n```\n' + html + '</div>\n```\n\n'
  const endorsement = join(source, config.endorsementFile)
  const files = [endorsement, ...(readdirSync(source) as string[]).filter((name: string) => /^[1234567].*\.md$/.test(name)).sort().map((name: string) => join(source, name))]
  const remaining = { ...config.sections }
  for (const file of files) { const number = numberedPart(file); if (remaining[number]) { all += `# ${remaining[number]}\n\n`; delete remaining[number] }; const rawBase = basename(file).replace(/^([-\d]+)-.*/, '$1'); const footnoteBase = config.footnoteSeparator === '_' ? `${rawBase.replaceAll('-', '_')}_` : rawBase; all += `${transformChapter(file, rawBase, footnoteBase, config, number === 0)}\n\n` }
  const preTex = (readdirSync(source) as string[]).filter((name: string) => /^0-2-.*\.md$/.test(name)).sort().map((name: string) => readUtf8(join(source, name)).replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}').replace(/^#+\s+(.+)/gm, '\\textbf{$1}').replace(/&/g, '\\&').replace(/\[(.*?)\]\((.*?)\)/g, '\\href{$2}{$1}').replace(/ \*(.*?)\*/g, ' \\emph{$1}').replace(/(\#\w)/g, '\\$1')).join('')
  return { markdown: all, preTex }
}

export function assembleEnglish(root: string, bookDate: string, creditsValue: unknown) { return assembleLocale(root, 'en', bookDate, creditsValue) }
export function assembleChinese(root: string, bookDate: string, creditsValue: unknown) { return assembleLocale(root, 'zh-TW', bookDate, creditsValue) }

export function buildBook(root: string, locale: Locale, outputDir: string, bookDate: string): void {
  const result = assembleLocale(root, locale, bookDate, JSON.parse(readUtf8(join(root, 'scripts', 'credits.json'))))
  mkdirSync(outputDir, { recursive: true })
  const stem = getLocale(locale).filePrefix
  writeFileSync(join(outputDir, `${stem}.md`), result.markdown)
  writeFileSync(join(outputDir, 'pre.tex'), result.preTex)
}

// Cast import.meta to read Bun-specific main property during direct script execution
const meta = import.meta as unknown as { main: boolean }
if (meta.main) {
  const [locale, outputDir] = process.argv.slice(2)
  if ((!isLocale(locale) && locale !== 'all') || !outputDir) {
    throw new Error(`Usage: BOOK_DATE=YYYY-MM-DD bun scripts/book/build.ts <${LOCALES.join('|')}|all> OUTPUT_DIR`)
  }
  const bookDate = process.env.BOOK_DATE
  if (!bookDate) throw new Error('BOOK_DATE is required')
  if (locale === 'all') {
    const sourceRevision = process.env.SOURCE_REVISION ?? process.env.GITHUB_SHA
    if (!sourceRevision) throw new Error('SOURCE_REVISION or GITHUB_SHA is required')
    for (const each of LOCALES) buildBook(process.cwd(), each, join(outputDir, each), bookDate)
    writeManifest(process.cwd(), outputDir, bookDate, sourceRevision)
  } else {
    buildBook(process.cwd(), locale, outputDir, bookDate)
  }
}
