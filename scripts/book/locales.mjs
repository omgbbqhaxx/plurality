// Single source of truth for every locale the book pipeline can build.
//
// This file is imported both by the TypeScript build scripts and by
// publication/vivliostyle.config.mjs, which is loaded by the Vivliostyle CLI
// outside our TypeScript pipeline. It therefore stays plain ESM JavaScript so
// any runtime can import it; scripts/book/locales.d.mts carries the types.
//
// Adding a language means adding one entry here, adding its credit labels to
// scripts/credits.json, and adding its chapters under contents/<directory>.

/** @type {Record<string, import('./locales.d.mts').LocaleDefinition>} */
export const localeDefinitions = {
  en: {
    directory: 'english',
    filePrefix: 'Plurality-english',
    title: 'Plurality',
    author: 'E. Glen Weyl, Audrey Tang and ⿻ Community',
    language: 'en',
    creditsKey: 'en',
    endorsementFile: '0-0-endorsements.md',
    footnoteSeparator: '-',
    coverPng: 'scripts/cover-image.png',
    coverPdf: 'scripts/cover-image.pdf',
    epubKeywords: ['Plurality', 'Weyl'],
    legacy: { fontSize: '18pt', epubCss: null, forceLangEnUs: false },
    metadata:
      'title: Plurality\nsubtitle: "The Future of Collaborative Technology and Democracy"\nauthor: "E. Glen Weyl, Audrey Tang and ⿻ Community"\nlang: en\ncover-image: scripts/cover-image.png \nmainfont: "Noto Serif"\nlinestretch: 1.25',
    sections: {
      1: 'Section 1: Preface',
      2: 'Section 2: Introduction',
      3: 'Section 3: Plurality',
      4: 'Section 4: Freedom',
      5: 'Section 5: Democracy',
      6: 'Section 6: Impact',
      7: 'Section 7: Forward',
      0: 'Endorsements',
    },
  },

  'zh-TW': {
    directory: 'traditional-mandarin',
    filePrefix: 'Plurality-traditional-mandarin',
    title: '多元宇宙',
    author: '衛谷倫、唐鳳、⿻社群',
    language: 'zh-TW',
    creditsKey: 'zh',
    endorsementFile: '0-0-名家推薦.md',
    footnoteSeparator: '_',
    coverPng: 'scripts/cover-image.zh-tw.png',
    coverPdf: 'scripts/cover-image.zh-tw.pdf',
    epubKeywords: ['多元', '唐鳳'],
    legacy: { fontSize: '20pt', epubCss: '/data/scripts/epub-cjk.css', forceLangEnUs: true },
    metadata:
      'title: 多元宇宙\nsubtitle: 協作技術與民主的未來\nauthor: 衛谷倫、唐鳳、⿻社群\nlang: zh-TW\ncover-image: scripts/cover-image.zh-tw.png \nlinestretch: 1.25',
    sections: {
      1: '一、序章',
      2: '二、導論',
      3: '三、多元',
      4: '四、自由',
      5: '五、民主',
      6: '六、影響',
      7: '七、前行',
      0: '名家推薦',
    },
  },

  tr: {
    directory: 'turkish',
    filePrefix: 'Plurality-turkish',
    title: 'Çoğulluk',
    author: 'E. Glen Weyl, Audrey Tang ve ⿻ Topluluğu',
    language: 'tr',
    creditsKey: 'tr',
    endorsementFile: '0-0-ovguler.md',
    footnoteSeparator: '-',
    // No Turkish cover art exists yet, so the edition ships with the English
    // cover. Replace both paths once scripts/cover-image.tr.{png,pdf} land.
    coverPng: 'scripts/cover-image.png',
    coverPdf: 'scripts/cover-image.pdf',
    epubKeywords: ['Çoğulluk', 'Weyl'],
    legacy: { fontSize: '18pt', epubCss: null, forceLangEnUs: false },
    metadata:
      'title: Çoğulluk\nsubtitle: "İşbirliğine Dayalı Teknolojinin ve Demokrasinin Geleceği"\nauthor: "E. Glen Weyl, Audrey Tang ve ⿻ Topluluğu"\nlang: tr\ncover-image: scripts/cover-image.png \nmainfont: "Noto Serif"\nlinestretch: 1.25',
    sections: {
      1: 'Kısım 1: Önsöz',
      2: 'Kısım 2: Giriş',
      3: 'Kısım 3: Çoğulluk',
      4: 'Kısım 4: Özgürlük',
      5: 'Kısım 5: Demokrasi',
      6: 'Kısım 6: Etki',
      7: 'Kısım 7: İleriye Doğru',
      0: 'Övgüler',
    },
  },
}

/** Every locale the pipeline knows how to build, in publication order. */
export const LOCALES = Object.keys(localeDefinitions)

/** True when `value` names a locale in the registry. */
export function isLocale(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(localeDefinitions, value)
}

/** Look up a locale, failing loudly rather than silently falling back. */
export function getLocale(locale) {
  if (!isLocale(locale)) {
    throw new Error(`Unknown locale: ${String(locale)}. Known locales: ${LOCALES.join(', ')}`)
  }
  return localeDefinitions[locale]
}
