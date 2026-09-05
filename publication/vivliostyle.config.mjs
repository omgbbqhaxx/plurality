import { join } from 'node:path'
import { getLocale } from '../scripts/book/locales.mjs'

const locale = process.env.BOOK_LOCALE || 'en'
const buildDir = process.env.BUILD_DIR || `dist/candidate/${locale}`
const outputRoot = process.env.OUTPUT_ROOT || join(buildDir, '..')

const { title, author, language, coverPng: cover } = getLocale(locale)

export default {
  title,
  author,
  language,
  size: 'A4',
  theme: 'publication/book.css',
  cover,
  viteConfigFile: false,
  entry: [
    join(buildDir, 'manuscript.md')
  ],
  toc: {
    sectionDepth: 2
  },
  vfm: {
    footnote: 'dpub'
  },
  output: [
    {
      path: join(outputRoot, 'candidate', `vivliostyle-${locale}-candidate.pdf`),
      format: 'pdf'
    },
    {
      path: join(outputRoot, 'candidate', `vivliostyle-${locale}-candidate.epub`),
      format: 'epub'
    }
  ]
}
