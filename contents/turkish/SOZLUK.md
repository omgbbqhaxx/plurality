# Türkçe Çeviri Sözlüğü

Bu dosya kitabın bölümlerine dâhil değildir; yalnızca çevirmenler içindir. Derleme
hattı yalnızca `0-1`, `0-2`, `0-3` ve `1`–`7` ile başlayan dosyaları toplar.

## Temel karar

Kitabın adı **Çoğulluk**, alt başlığı **İşbirliğine Dayalı Teknolojinin ve
Demokrasinin Geleceği**'dir.

`⿻` (U+2FFB) karakteri **olduğu gibi korunur**, Mandarin sürümünde olduğu gibi.
Sözcük olarak açılması gerektiğinde "Çoğulluk" kullanılır. Karakterin kendisi
kitabın görsel kimliğidir; metinde geçtiği yerde silinmez.

> Not: "collaborative" için **"işbirlikçi"** *kullanılmaz*. Türkçede bu sözcük
> "düşmanla işbirliği yapan" anlamını taşır. Yerine **"işbirliğine dayalı"**
> veya bağlama göre **"ortak"** / **"birlikte çalışan"** kullanılır.

## Terim karşılıkları

| İngilizce | Türkçe | Not |
|---|---|---|
| Plurality | Çoğulluk | Kitap adı ve ana kavram |
| plural | çoğul | |
| ⿻ | ⿻ | Korunur, çevrilmez |
| collaborative technology | işbirliğine dayalı teknoloji | "işbirlikçi" değil |
| Plural Credits (PCs) | Çoğul Krediler | İlk geçtiği yerde kısaltma açıklanır |
| Quadratic Voting (QV) | Karesel Oylama | |
| Quadratic Funding (QF) | Karesel Fonlama | |
| Data Coalitions | Veri Koalisyonları | |
| Data Dignity | Veri Onuru | |
| Augmented Deliberation | Genişletilmiş Müzakere | |
| Adaptive Administration | Uyarlanabilir Yönetim | |
| Social Markets | Sosyal Piyasalar | |
| Post-Symbolic Communication | Post-Sembolik İletişim | |
| Immersive Shared Reality | Sürükleyici Paylaşılan Gerçeklik | |
| Rights, OS | Haklar, İşletim Sistemi | |
| personhood | kişilik | Hukuki anlamda |
| identity | kimlik | |
| association | ortaklık / birliktelik | Bağlama göre |
| public(s) | kamu(lar) | |
| commons | müşterekler | |
| deliberation | müzakere | |
| governance | yönetişim | "yönetim" değil |
| administration | yönetim | |
| stakeholder | paydaş | |
| accountability | hesap verebilirlik | |
| legitimacy | meşruiyet | |
| polarization | kutuplaşma | |
| bridging | köprüleme | Sosyal sermaye bağlamında |
| bonding | bağlama | Sosyal sermaye bağlamında |
| social capital | sosyal sermaye | |
| trust | güven | |
| digital democracy | dijital demokrasi | |
| technocracy | teknokrasi | |
| libertarianism | liberteryenizm | |
| DAO | DAO | Kısaltma korunur |
| blockchain | blokzincir | |
| ledger | defter | |
| protocol | protokol | |
| interoperability | birlikte çalışabilirlik | |
| open source | açık kaynak | |
| fork | çatal / fork | Teknik bağlamda "fork" |
| pull request | çekme isteği (pull request) | |

## Biçim kuralları

- **Dipnot etiketleri çevrilmez.** `[^VDem]` gibi etiketler İngilizce
  kaynaktakiyle birebir aynı kalır; derleme hattı bunların başına bölüm
  numarasını ekler. Yalnızca dipnotun *içeriği* çevrilir.
- **Bağlantı adresleri değiştirilmez.** Yalnızca bağlantı metni çevrilir.
- **Görsel yolları değiştirilmez.** `figs/` altındaki dosyalar ve
  `raw.githubusercontent.com` adresleri aynen korunur.
- **Kaynakça verileri özgün dilinde kalır.** Kitap adı, yayınevi ve dergi adı
  çevrilmez; gerekirse parantez içinde Türkçe açıklama eklenir.
- **Dosya adları yalnızca ASCII harf içerir.** `ö, ü, ç, ş, ğ, ı, İ` yerine
  ASCII karşılıkları kullanılır (`0-0-ovguler.md`). Sebebi: macOS dosya
  adlarını NFD, Linux NFC biçiminde saklar; Türkçe harfler bu iki biçimde
  farklı baytlara çözümlenir ve yerel makine ile CI arasında eşleşmeme
  yaratır. `⿻` karakterinin çözümlemesi olmadığı için o korunabilir.
- **Türkçe tırnak** olarak `"..."` kullanılır; özgün metindeki eğik tırnaklar
  düz tırnağa çevrilebilir.
