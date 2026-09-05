import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOCALES, getLocale } from './locales.mjs'
import type { Locale } from './locales.d.mts'

export interface ChapterManifest {
  id: string
  slug: string
  title: string
  path: string
}

export interface LocaleManifest {
  language: string
  title: string
  manuscriptPath: string
  legacyOutputs: {
    pdf: string
    epub: string
  }
  vivliostyleOutputs: {
    pdf: string
    epub: string
  }
  chapters: ChapterManifest[]
}

export interface BookManifest {
  schemaVersion: string
  sourceRevision: string
  publicationDate: string
  locales: Record<Locale, LocaleManifest>
}

const readUtf8 = (path: string): string => readFileSync(path, 'utf8')

export function parseChapter(root: string, localeDir: string, name: string): ChapterManifest {
  const fullPath = join(root, 'contents', localeDir, name)
  const content = readUtf8(fullPath)
  const h1Match = content.match(/^#\s+(.+)$/m)
  if (!h1Match) throw new Error(`Missing H1 in chapter file: ${join('contents', localeDir, name)}`)
  const title = h1Match[1].trim()

  const match = name.match(/^([1-7](?:-\d+)?)-(.*)\.md$/)
  if (!match) throw new Error(`Invalid chapter filename format: ${name}`)
  const id = match[1]
  const slug = match[2]

  return {
    id,
    slug,
    title,
    path: join('contents', localeDir, name),
  }
}

export function generateManifest(root: string, bookDate: string, sourceRevision: string): BookManifest {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookDate)) throw new Error(`Invalid BOOK_DATE: ${bookDate}`)
  if (!sourceRevision || sourceRevision.trim() === '') throw new Error('Invalid sourceRevision: cannot be empty')

  const locales = {} as Record<Locale, LocaleManifest>
  for (const locale of LOCALES) {
    const definition = getLocale(locale)
    locales[locale] = {
      language: locale,
      title: definition.title,
      manuscriptPath: `${locale}/${definition.filePrefix}.md`,
      legacyOutputs: {
        pdf: `legacy/${definition.filePrefix}.pdf`,
        epub: `legacy/${definition.filePrefix}.epub`,
      },
      vivliostyleOutputs: {
        pdf: `candidate/vivliostyle-${locale}-candidate.pdf`,
        epub: `candidate/vivliostyle-${locale}-candidate.epub`,
      },
      chapters: [],
    }
  }

  for (const locale of LOCALES) {
    const localeDir = getLocale(locale).directory
    const dirPath = join(root, 'contents', localeDir)
    const files = readdirSync(dirPath).filter((name) => /^[1-7].*\.md$/.test(name)).sort()

    const ids = new Set<string>()
    const chapters: ChapterManifest[] = []

    for (const file of files) {
      const chapter = parseChapter(root, localeDir, file)
      if (ids.has(chapter.id)) throw new Error(`Duplicate chapter ID "${chapter.id}" in locale ${locale}`)
      ids.add(chapter.id)
      chapters.push(chapter)
    }

    locales[locale].chapters = chapters
  }

  return {
    schemaVersion: '1.0.0',
    sourceRevision,
    publicationDate: bookDate,
    locales,
  }
}

export function writeManifest(root: string, outputDir: string, bookDate: string, sourceRevision: string): void {
  const manifest = generateManifest(root, bookDate, sourceRevision)
  writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
}

// Cast import.meta to read Bun-specific main property during direct script execution
const meta = import.meta as unknown as { main: boolean }
if (meta.main) {
  const [outputDir] = process.argv.slice(2)
  if (!outputDir) throw new Error('Usage: BOOK_DATE=YYYY-MM-DD SOURCE_REVISION=rev bun scripts/book/manifest.ts OUTPUT_DIR')
  const bookDate = process.env.BOOK_DATE
  if (!bookDate) throw new Error('BOOK_DATE is required')
  const sourceRevision = process.env.SOURCE_REVISION ?? process.env.GITHUB_SHA
  if (!sourceRevision) throw new Error('SOURCE_REVISION or GITHUB_SHA is required')
  writeManifest(process.cwd(), outputDir, bookDate, sourceRevision)
}
