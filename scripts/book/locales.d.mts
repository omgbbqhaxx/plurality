export type Locale = 'en' | 'zh-TW' | 'tr'

/** Credit label sets available in scripts/credits.json under `i18n`. */
export type CreditsKey = 'en' | 'zh' | 'tr'

export interface LegacyRenderOptions {
  /** Base font size handed to XeLaTeX for this edition. */
  fontSize: string
  /** Extra stylesheet passed to the EPUB build, or null for none. */
  epubCss: string | null
  /** Forces `-M lang=en-US` so XeLaTeX hyphenation stays sane for CJK text. */
  forceLangEnUs: boolean
}

export interface LocaleDefinition {
  /** Chapter source directory under contents/. */
  directory: string
  /** Output filename stem, e.g. `Plurality-english`. */
  filePrefix: string
  title: string
  author: string
  /** BCP-47 tag written into book metadata. */
  language: string
  creditsKey: CreditsKey
  /** Endorsements chapter filename inside the source directory. */
  endorsementFile: string
  /** Character joining the chapter number to footnote labels. */
  footnoteSeparator: string
  coverPng: string
  coverPdf: string
  /** Words that must appear in the rendered EPUB for it to validate. */
  epubKeywords: string[]
  legacy: LegacyRenderOptions
  /** Pandoc YAML metadata block for the assembled manuscript. */
  metadata: string
  /** Part headings keyed by the leading digit of chapter filenames. */
  sections: Record<number, string>
}

export declare const localeDefinitions: Record<Locale, LocaleDefinition>
export declare const LOCALES: Locale[]
export declare function isLocale(value: unknown): value is Locale
export declare function getLocale(locale: unknown): LocaleDefinition
