# KOŞU v1 — seviyorsevmiyor

Hedef cümlesi, tek satır, hiçbir fazda değişmez.

> **Sohbet + cihaz → desen + kart.**

Bu koşunun bitiş şartı bir ölçüm değil. Bitiş şartı şu: tanımadığın biri
siteye girer, sohbetini bırakır, ne olduğunu okur, kartını Instagram
hikayesine atar, bir arkadaşı o kartı görüp siteye gelir. "Bak şuna" diyen
ikinci kişi çıktığı gün koşu bitmiştir.

---

## KİM İÇİN, VE NEREDE ÇÖKÜYOR

Üç kullanıcı var. Her fazın kabul testi bunlardan birine bakar.

| kim | ne istiyor | çöktüğü yer |
|---|---|---|
| **Situationship'te sıkışmış kişi** | "biz neyiz, ne oldu, ne zaman değişti" sorusuna bir cevap | export 6 adım, telefonda sekme çöküyor, az mesajda ekran boş kalıyor |
| **Kartı gören arkadaş** | merak edip kendi sohbetini denemek | paylaşılacak kart yok, kart Instagram'da herhangi bir alıntı sayfasından ayrılmıyor |
| **LinkedIn'deki mühendis** | motorun nasıl çalıştığını görmek | README yok, ölçüm tablosu hiçbir yerde durmuyor |

**Kullanıcı yolculuğu ve bilinen ölüm noktaları.** Her adımın yanında onu
koruyan faz var. Fazı olmayan adım, bugün ölü.

```
1  siteye girer, ne olduğunu anlar                      S4 S14
2  "?" ye basar, nasıl çalıştığını okur                 S4
3  sohbetini bırakır                       ← ÖLÜ        S0 S4
4  telefonda büyük dosya çökmüyor          ← ÖLÜ        S0
5  10 mesajı varsa da bir şey alıyor       ← ÖLÜ        S5
6  desenleri okur                                       S5 S6 S7
7  cümleler LLM'siz de iyi                 ← ÖLÜ        S9
8  kartını görür                           ← ÖLÜ        S10
9  kartı paylaşır                          ← ÖLÜ        S11
10 arkadaşı kartı görüp geliyor mu         ← ÖLÜ        S12
11 sohbeti cihazdan çıkmıyor, iddia doğru  ← ÖLÜ        S3
12 sayaç dolunca ürün çalışmaya devam ediyor            S9
13 kaç kişi geldi, kaçı paylaştı           ← ÖLÜ        S13
14 LinkedIn'de anlatılacak hikâye          ← ÖLÜ        S14
```

**v72'nin cevabı bu tabloda.** Motor 5-6-7 arasını yazdı, hem de iyi yazdı.
1-4 ve 8-14 hiç yazılmadı. O yüzden 72 sürüm boyunca ürün "canlı" oldu ama
kimse kullanmadı.

---

## 0. ORKESTRASYON

### 0.1 Roller

**Şef.** Tek bir oturum. Sıfır iş yapar. Disk taramaz, belge okumaz, kod
yazmaz, ölçmez. Üç şey yapar: kart yapıştırır, ajan doğurur, hakem doğurur.
Dördüncü bir şey yaparsa koşu bozulmuştur.

**Ajan.** Her faz için taze doğar. Sadece kendi kartını görür. Önceki
fazların kartlarını, tartışmalarını, hakem raporlarını GÖRMEZ. Sadece kod
tabanını ve kendi kartını görür. İşi biter, üç satır yazar, ölür.

**Hakem.** Her faz için ayrı doğar. Ajanın raporunu GÖRMEZ. Eline üç şey
geçer: kart, `git diff`, ve kabul komutunun kendisi. Komutu kendi çalıştırır.
Ajanın "geçti" demesi hiçbir şey ifade etmez.

**Damla.** Döngünün dışında. Tek aksiyonu şefin açılış bloğunu bir kez
yapıştırmak, ve `GIRDI/` klasörünü doldurmak. Ajan Damla'ya soru soramaz.

### 0.2 Hakem üç cevaptan birini verir

```
GEÇTİ      — kabul komutu eşiği tutturdu, diff kartın izin verdiği dosyalarda kaldı
KALDI      — komut eşiği tutturmadı. Ajan yeniden doğar, AYNI kartla, hakemin
             ölçtüğü sayı kartın altına eklenir. En fazla iki kez.
KART YANLIŞ — kart yanlış şeyi ölçüyor, ya da eşik yanlış yerde. Hakem kartı
             yeniden yazar, gerekçesini bu dosyaya düşer, faz baştan koşar.
```

`KART YANLIŞ` Damla'nın eski yeridir. Artık hakemin. Hakem kartı yeniden
yazarken **eşiği sadece zorlaştırabilir.** Kolaylaştırma yönünde tek bir
değişiklik yapamaz. Kolaylaştırma gerekiyorsa koşu durur ve Damla'yı bekler.
Bu, hakem+ajan ikilisinin insan yokken "geçti" üretmesini engelleyen tek kilit.

### 0.3 Birikimli hata

Her kart, kendinden önceki **tüm** fazların kabul komutlarını taşır. Hakem
hepsini koşar. S8'in hakemi S3'ün komutunu da çalıştırır. Biri kızarırsa koşu
durur, sonraki faz açılmaz, ve kızaran fazın adı bu dosyaya yazılır.

Mevcut altı kapı her fazın hakemi tarafından koşulur, istisnasız:

```
for t in parse timeline cpd e2e yazi bulut; do node train/${t}_check.mjs; done
python3 train/parity_check.py && node train/parity_check.mjs
```

### 0.4 Kart formatı

Şef her fazı bu dört satırla açar. Beşinci satır yok.

```
KULLANICI CÜMLESİ : <bir cümle, kullanıcının ağzından, audit başlığı değil>
KABUL KOMUTU      : <tek satır, kopyala-yapıştır çalışır>
EŞİK              : <bir sayı>
DOKUNULABİLİR     : <dosya listesi. dışına çıkmak KART YANLIŞ değil, KALDI'dır>
```

### 0.5 Ajan raporu

Üç satır. Dördüncü satır yok.

```
NE DEĞİŞTİ  : dosya:satır
KOMUT ÇIKTISI: <yapıştır>
YAPILAMAYAN : <varsa, adıyla>
```

### 0.6 Kayıt

Tek dosya, bu dosya. Faz başına bir blok. Blok formatı:

```
## S<n> — <ad> — <GEÇTİ|KALDI×n|KART YANLIŞ>
ölçülen: <sayı>   eşik: <sayı>   commit: <sha>
hakem notu: <tek cümle>
```

### 0.7 Değişmeyen kurallar

- **Main.** Branch yok. Her faz maine commit.
- **Ölçmeden iddia yok.** Kod hakkında "çalışıyor" demeden önce çalıştır.
- **Uydurma sayı yok.** Kaynağı olmayan sayı koda giremez. Kaynak yoksa en
  kısıtlayıcı değer seçilir ve "uydurma" etiketiyle ilan edilir.
- **Sessiz default yok.** Motor bilmediği bir şeyi söylemez, adıyla susar.
- **LLM ağızdır, hakim değildir.** Hüküm, sayı ve bayraklar cihazdaki
  motordan gelir; model sadece cümleyi kurar. Kurduğu cümle kanunla
  çelişiyorsa atılır, onarılmaz. Bu ilke dört yerde kodla uygulanmış ve
  dördü de gerçek bir hatadan doğdu: `quoteIsInDoc` (uydurma alıntıyı eler),
  `zamanGecerli` (çıktıda rakam varsa okumayı reddeder), `olguTemiz` (buluta
  sadece sayı geçebilir), şarkı loop'u. **Yeni bir LLM alanı eklenirse
  doğrulayıcısıyla birlikte eklenir.**
- **Şablon satırları yangın çıkışıdır.** Rıza yoksa, worker düşükse, sayaç
  dolduysa ürün yine çalışır. Bu yol asla kapatılmaz.
- **Desen verilir, sebep verilmez.** "Ne" ölçülür. "Neden" ölçülmez.
- **Her reddin bir sonraki adımı vardır.** "Bu sohbette tarih bulamadım" tek
  başına kabul edilmez. Yanında ya söyleyebildiği en yakın şey, ya da
  kullanıcının yapabileceği bir aksiyon olmak zorunda. Boş ekran bir hatadır.
- **Kullanıcının verisi üçüncü tarafa gidiyorsa bu ekranda yazar.** S3
  kapanana kadar eski akış ham metni Groq'a yolluyor. Sessiz kalmak yasak.
- **Localhost yok, headless yok** (`.rabadon/guard.json`). Bu kural ajanı
  körleştiriyor; S4'ün hakemi bunu KART YANLIŞ ilan edebilir ve yasağı
  "og.png üretimi yasak" diye daraltabilir. Yasak zaten og.png içindi.
- **Commit mesajında backtick, `$()`, `;` yok.** 16 Ağu'da commit mesajındaki
  backtick zsh'de çalıştı ve worker kazara canlıya deploy oldu (Version ID
  0bced59e).
- **Acil durum kolları.** Worker'ı sustur: `SPIKER_OPEN = "off"`. Deploy'u
  geri al: `npx wrangler rollback`. Sayfayı geri al: gh-pages'e önceki `web/`.

### 0.8 Elle düzenlenmeyen dosyalar

```
web/data/model.json        train/train.py çıktısı. Sadece held-out'u
                           İYİLEŞTİRİYORSA ship edilir. Sentetik veri
                           yalnızca eğitimde, held-out gerçek veri.
web/og.png                 Damla'nın elle 1200x630 export'u (og.svg'den)
train/parity_expected.json çıktıya uydurulamaz
.rabadon/guard.json        ajan gevşetemez
```

---

## S0 · TARAYICI MASASI

**Bu fazı ŞEF koşamaz. Damla koşar. BİRİNCİ SERT DURAK.**

Gerçek telefon, gerçek WhatsApp export'u, gerçek Instagram in-app tarayıcısı
gerekiyor. Ajanın eli yok.

**Neden gerekli.** Zaman motoru Node'da altı kapıdan geçiyor ve ölçümleri
iyi: null seride yanlış pozitif %0, sürüklenmede %0, gerçek 4x sıçramada güç
%75, tarih güven aralığı kapsama %89.3 (nominal %90), 39.5k mesaj 686 ms.
E2E: ekilen kırılma 2 Nisan, bulunan 3 Nisan.

**Ama 686 ms Node'da ölçüldü, tarayıcıda değil.** Dosya bırakma, zip açma,
worker, DOM'a basma hiç denenmedi. Mobil Safari'nin bellek sınırı katı; zip
açma + string parse aynı anda bellek yiyor, büyük export'ta sekme sessizce
çöker ve kullanıcı hiçbir şey görmez.

**Şefin dolduracağı** — yok. Bu faz tamamen Damla'nın.

**Damla'nın dolduracağı**

```
GIRDI/tarayici/
  rapor.md         aşağıdaki altı testin sonucu
  ss-*.png         her testin ekran görüntüsü
```

**Altı test, sırayla zorlaşıyor**

```
T1  masaüstü, küçük export (birkaç yüz mesaj)
    sayfa açılıyor · dosya kabul ediliyor · zip açılıyor ·
    ekranda SONUÇ var (spinner'da kalmıyor) · konsolda hata var mı
    kaydet: ekran görüntüsü + konsol çıktısı birebir

T2  masaüstü, büyük export (20 MB+, en uzun sohbet)
    kaç MB, kaç mesaj, kaç saniye · sekme dondu mu ·
    bellek tepe değeri (geliştirici araçları → Memory)
    NOT: Node'da 39.5k mesaj 686 ms. Tarayıcıda 5-10 katı normal,
    100 katı parse'ın ana thread'i kilitlediği anlamına gelir.

T3  telefon, normal tarayıcı (Safari/Chrome)
    sayfa açılıyor mu · dosya seçici export'a erişiyor mu ·
    büyük dosyada sekme çöküyor mu (Safari çökerse sayfa kendiliğinden
    yenilenir, bu bellek yetersizliğidir) · süre

T4  Instagram in-app tarayıcı  ← EN KRİTİK
    kendine linki DM at, Instagram içinden aç, Safari'den AÇMA
    sayfa açılıyor mu · DOSYA SEÇİCİ ÇALIŞIYOR MU ·
    export seçilebiliyor mu · sonuç geliyor mu

T5  bulut yolu
    "bulut" butonu çalışıyor mu · ağ sekmesinde /api/zaman gövdesine bak:
    MESAJ METNİ VAR MI (olmamalı, sadece sayı) · kalan sayaç görünüyor mu ·
    sayaç sıfırken şablona düşüyor mu, hata mı veriyor

T6  yapıştırma yolu
    kısa sohbet yapıştırınca çalışıyor mu ·
    telefonda uzun sohbeti kopyalamak pratikte mümkün mü (muhtemelen değil)
```

**Çıktısı sonraki fazları değiştirir**

- T2/T3 donuyorsa → parse Web Worker'a taşınır ve chunk'lanır, S4'e madde eklenir
- **T4 başarısızsa** → export yolu kapanır, ekran görüntüsü ana yol olur, ve
  OCR **bir satır iş değil, kendi fazı olur** (aşağıya bak)
- T5'te metin varsa → S3'ün kapsamı büyür, S3 yeniden koşar

**T4 başarısızsa OCR ne olacak.** OCR bir yedek plan gibi yazılamaz.
Tesseract.js mobilde ağır (20-30 MB model indirir) ve WhatsApp ekran
görüntüsü OCR için zor bir girdi: arka plan deseni, küçük saat damgaları,
okundu tikleri. Naif bir `Tesseract.recognize` çağrısı testten geçer ama
gerçek görüntüde "seni seviyorum"u "semi sev!yorumn 14:02 //" diye okur ve
**motorun tamamı bu çöp veriyle çöker** — kelime sayımı, efor, zaman damgası,
hepsi. Yanlış okunmuş bir sohbetten üretilen desen, ürünün tek iddiasını
yalanlar.

Bu yüzden T4 başarısızsa araya **S4b · OCR MASASI** girer: görüntü ön işleme
(kırpma, eşikleme, tik/damga temizliği), Türkçe karakter kalibrasyonu, 10
gerçek görüntüyle karakter hata oranı ölçümü, ve **kabul eşiği** — eşiğin
üstündeyse o görüntü reddedilir, kullanıcıya "bu görüntüyü okuyamadım" denir.

**Motor tarayıcıda hiç koşmuyorsa.** Web Worker'da ve chunk'lanmış haliyle de
koşmuyorsa bu bir faz sorunu değil, mimari sorundur ve koşu durur. İki yol
var, ikisi de ürünü değiştirir:
- **Sunucuda hesap** → "cihazından çıkmaz" iddiası düşer, ürünün tek farkı
  gider. Bu artık başka bir üründür, bu plan geçersizdir
- **WASM / daha ucuz algoritma** → iddia korunur, motor yeniden yazılır, aylık iş

İhtimal düşük (motor saf JS ve 39.5k mesajı Node'da 686 ms'de çeviriyor) ama
sıfır değil. S0'ın erken olmasının tek sebebi bu: yanlış cevabı **ilk gün**
öğrenmek.

```
KULLANICI CÜMLESİ : Sohbetimi telefondan bıraktım ve ekranda sonucu gördüm.
KABUL KOMUTU      : test -f GIRDI/tarayici/rapor.md && grep -c "^T[1-6]" GIRDI/tarayici/rapor.md && ls GIRDI/tarayici/ss-*.png | wc -l
EŞİK              : rapor.md var · 6 test de raporlanmış · ≥ 4 ekran görüntüsü
                    · T4 sonucu "calisiyor" veya "calismiyor" olarak net yazılı
DOKUNULABİLİR     : GIRDI/tarayici/
```

---

## S1 · "DEPO TEMİZ VE SIZINTI YOK"

**Kullanıcı cümlesi.** Repoyu açan biri ne yaptığımızı anlıyor, ve hesabımın
bilgileri ortalıkta durmuyor.

**Sızıntı.** `.wrangler/cache/wrangler-account.json` commitli: Cloudflare hesap
ID'si ve kişisel gmail adresi public repoda. `.claude/settings.json` de
`/Users/damummyphus/...` mutlak yolunu sızdırıyor ve başka makinede zaten
sessizce düşüyor. Bunlar secret değil ama phishing ve sosyal mühendislik
yüzeyi. Dosyayı silmek yetmez, history rewrite gerekir:

```bash
git filter-repo --path .wrangler --invert-paths
```

**Ölü ağırlık.**

| yol | ne | neden |
|---|---|---|
| `mockups/` | 24 HTML | terkedilmiş tasarım denemeleri |
| `web/assets/bubbles/` | 14 sprite | bırakılmış "kabarcık denizi" tasarımından |
| `web/vercel.json` | 1 | site gh-pages'te, Vercel kullanılmıyor |
| `backend/supabase-schema.sql` | 1 | Supabase kullanılmıyor |
| `/api/read` | worker rotası | eski Gemini yolu, `PUBLIC_READ=off`, hiç kullanılmıyor, ikinci bir sağlayıcı anahtarı gerektiriyor |
| `index.html` boş "flört tavsiyesi" | placeholder | ya doldurulur ya kalkar |

**Belge kayması.** `PROJECT.md` hâlâ "whatdoyoumean" adıyla başlıyor ve Gemini
şelalesini anlatıyor; `CLAUDE.md` Groq diyor. Proje 15 Tem'de
`mesajibirokusana`'dan `seviyorsevmiyor`'a döndü. Tek doğru kaynak `CLAUDE.md`
+ bu dosya olur, `PROJECT.md` arşive çekilir.

**Silinmeyecek.** `linkedin.md` (164 satır) ve `devlog.md` (462 satır). Bunlar
Damla'nın tüm projelerdeki standart içerik hattı ve S14'ün yakıtı. Sıfırdan
içerik üretilmeyecek, bu hattın devamı yazılacak.

```
KULLANICI CÜMLESİ : Repoyu açtım, ne yaptığınızı anladım, kimsenin e-postası ortada değil.
KABUL KOMUTU      : git log --all -p | grep -cE "KISISEL_ADRES_1_REDACTED|CF_ACCOUNT_ID_REDACTED" ; git ls-files | wc -l
EŞİK              : 0  ve  git ls-files ≤ 120
DOKUNULABİLİR     : repo geneli; engine ve web/js/time hariç
```

---

## S2 · "ANAHTARIM SÖMÜRÜLMÜYOR"

**Kullanıcı cümlesi.** Siteyi kullanmayan biri benim API bütçemi harcayamıyor.

**Teşhis.** `backend/worker.js` sonunda:

```js
function cors() {
  return { 'Access-Control-Allow-Origin': '*', ... };
}
```

Worker herkese açık. `SPIKER_OPEN = "on"` ve tek gerçek sigorta global
günlük cap. Per-IP sayaçlar (`limited()`) KV'de read-then-write yapıyor,
atomik değil (KV ~1 yazma/sn/anahtar, 60 sn'ye kadar tutarsız) ve IP
döndürülerek zaten aşılır.

Ayrıca `/api/itiraz` `corpus:` anahtarlarını **TTL'siz** yazıyor. Üçüncü
kişinin mesajları süresiz saklanıyor. KVKK saklama süresi ihlali.

**İş.**

1. Origin kontrolü. Worker sadece kendi sayfasından gelen isteği kabul eder.
2. Görünmez Turnstile. Sunucuda `siteverify`, sonra kısa ömürlü kendi token'ın.
   İstemci widget'ı tek başına korumaz; saldırgan endpoint'e doğrudan POST atar.
   Origin IP sızarsa Authenticated Origin Pulls (mTLS).
3. `corpus:` anahtarlarına `expirationTtl`.
4. `/api/read` silinir (S1'de zaten ölü ağırlık listesinde).

**`/api/itiraz` çarkı kapatılmaz.** "Yanlış okudun" + bağış onayı ile gelen zor
vakalar eğitim verisi oluyor ve amaç seed'i büyütüp LLM payını küçültmek.
Fikir doğru, sadece TTL'siz olması yanlış.

**KV → Durable Objects bu fazda DEĞİL.** Sayaç 100, Groq ücretsiz katmanı
1000/gün. Yarış durumunda sayaç 100 yerine 130 sayar, hâlâ tavanın onda
birinde. Asıl sömürü riski açık CORS'tu ve bu fazda kapanıyor. Sayaç 1000'e
çıkarılırsa DO bu faza çekilir.

```
KULLANICI CÜMLESİ : Siteyi açmadan worker'a istek atmayı denedim, reddedildi.
KABUL KOMUTU      : node backend/tests/origin_turnstile_check.mjs
                    (yazılacak: yabancı origin 403, kendi origin 200,
                     itiraz PUT'unda expirationTtl var mı)
EŞİK              : yabancı origin = 403 · kendi origin = 200 ·
                    TTL'siz KV yazımı = 0
DOKUNULABİLİR     : backend/worker.js, backend/wrangler.toml, backend/tests/, web/js/api.js
```

---

## S3 · "MESAJLARIM CİHAZIMDAN ÇIKMIYOR"

**Kullanıcı cümlesi.** Sayfada yazan gizlilik cümlesi doğru.

**Bu, ürünün ana iddiasını doğru yapan fazdır.** Kapanmadan "cihazından
çıkmaz" cümlesi hiçbir yerde yazılamaz: ne ana sayfada, ne "?" penceresinde,
ne LinkedIn'de. Rakiplerin hepsi (Lucen, AfterMatch, Red Flag ailesi, Selka)
sohbet metnini ABD buluta yolluyor; tek gerçek farkımız bu ve bugün yalan.

**Teşhis.** İki akış var, biri temiz biri değil.

```
zaman akışı  → olguTemiz() duvarı: buluta sadece düz sayı geçiyor,
               en fazla 24 alan, string elenmiş.
               train/bulut_check.mjs bunu kanıtlıyor.  ✓

eski akış    → web/js/api.js:spikerRead(facts, doc)
               ham `doc` gövdede gidiyor. 6000 karaktere kadar
               sohbetin kendisi Groq'a ulaşıyor.       ✗
```

Ana sayfanın `og:description`'ı ise şunu diyor: *"analiz cihazında yapılır,
mesajların cihazından çıkmaz."*

**İş.**

1. `spikerRead()` ham `doc` yollamayı bırakır.
2. Zaman akışındaki olgu-tabanlı yapı eski akışa taşınır.
3. `bulut_check` benzeri bir kapı eski akış için de yazılır.

**Uyarı, sonraki fazlara.** Bu, spiker girdisini değiştirir. `quoteIsInDoc`
artık sohbete erişemeyeceği için alıntı mekanizması ölür; S8 promptu buna göre
yazılacak. Ve S8'deki şarkı seçimi de sohbeti değil **desen kombinasyonunu**
görecek.

```
KULLANICI CÜMLESİ : Ağ sekmesini açtım, giden istekte tek bir mesajım yok.
KABUL KOMUTU      : node train/bulut_check.mjs && node train/bulut_check_eski.mjs
EŞİK              : ikisi de yeşil · giden gövdede metin alanı sayısı = 0
DOKUNULABİLİR     : web/js/api.js, backend/worker.js, train/
```

---

## S4 · "TEK SAYFA, TEK AKIŞ"

**Kullanıcı cümlesi.** Siteye girdim, ne yapacağımı anladım, sohbetimi bıraktım.

**⛔ S0 raporu olmadan başlamaz.** T4'ün sonucu giriş stratejisini belirliyor.

**Teşhis.** İki ayrı sayfa var, aralarında geçiş yok, ikisi de aynı işi
yapıyor: `index.html` (flört hükmü) ve `zaman.html` (kırılma tarihi).
Tek seferlik kullanıcı iki kapı görünce düşünmez, çıkar.

**Karar.** Kabuk `index.html`. Zaman motoru içine girer, `zaman.html` kalkar.
Zaman ayrı bir ürün değil, desen üreticilerinden biri.

**Huninin en dar yeri burası.** Kullanıcı Instagram hikayesinden geliyor,
Instagram'ın in-app tarayıcısında açılıyor. Oradan WhatsApp'a çıkıp sohbeti
bulup export alıp dosyayı kaydedip geri dönmesi gerekiyor. Üç girişin üçü de
sınırlı:

- **Ekran görüntüsü** en düşük sürtünmeli (zaten telefonda), ama OCR hiç test edilmedi
- **Yapıştırma** kısa sohbette iyi, mobilde 10.000 satırı taşımaz
- **Export** en zengin veri, en yüksek sürtünme, 6 adım

Sıra: yapıştırma ve ekran görüntüsü önde, export ileri seçenek.

**"?" yardım penceresi.** Talimatlar şu an `zaman.html`'in gövdesinde ve ilk
ekranı dolduruyor. Başlıktaki bir "?" arkasına alınır: isteyen açar, ilk ekran
boşalır.

```
nasıl çalışır?

sohbeti buraya bırak. analiz cihazında yapılır.
hiçbir mesaj sunucuya gitmez, hiçbir yerde saklanmaz.
veritabanı yok. saklayacak bütçem de yok, o yüzden saklamıyorum.
sayfayı kapattığında geriye bir şey kalmaz.

── sohbeti nasıl dışa aktarırsın? ──

iphone
1. whatsapp'ta sohbeti aç
2. üstteki isme dokun
3. aşağı in, sohbeti dışa aktar
4. medya olmadan seç
5. dosyalara kaydet
6. buraya o dosyayı bırak

android
1. whatsapp'ta sohbeti aç
2. sağ üstteki üç noktaya dokun
3. diğer, sonra sohbeti dışa aktar
4. medya olmadan seç
5. buraya o dosyayı bırak

ekran görüntüsü de olur. metni de yapıştırabilirsin.
```

Gizlilik cümlesi **başta** duruyor çünkü kullanıcının ilk tereddüdü o.

**Bütçe gerekçesi sayfada kalır.** "Saklamamayı tercih ediyoruz" her rakibin
yazdığı ve kimsenin inanmadığı cümle; "saklayacak bütçem yok" doğrulanabilir
ve inandırıcı. Ajan bu satırı kaldırmaz, yumuşatmaz, kurumsallaştırmaz.

**Hook metni.** Ajan yazar. Bölüm SES'teki kuralları ve VİRAL DERSLER'i okur.
Damla'ya sorulmaz; boş sayfa Damla'yı beklemez.

```
KULLANICI CÜMLESİ : Tek sayfa gördüm, tek yol vardı, sohbetimi bıraktım.
KABUL KOMUTU      : node web/tests/tek_akis_check.mjs
                    (yazılacak: zaman.html yok · "?" penceresi DOM'da ·
                     gizlilik metni birebir · ölü link sayısı)
EŞİK              : zaman.html = 0 · ölü link = 0 · "?" penceresi açılıyor ·
                    gizlilik bloğu birebir eşleşiyor (bütçe satırı dahil)
DOKUNULABİLİR     : web/index.html, web/js/{app,zaman,ui}.js, web/css/, web/tests/
```

---

## S5 · "10 MESAJLA DA BİR ŞEY ALDIM"

**Kullanıcı cümlesi.** Kısa bir sohbet yapıştırdım ve ekran boş kalmadı.

**Teşhis.** `web/js/time/honesty.js`:

```js
anyTimeClaim: { messages: 500, days: 60 }
```

Bu kapının altında tüm zaman katmanı susuyor. İlk kullanıcıların çoğu bu
ekranı görecek. Ve "yeterli veri yok" bir çıktı değildir — kimse onu paylaşmaz.

**Ama kapının kalkması "her sinyal her boyutta çalışır" demek değil.** 10
mesajda trend okumak fal bakmaktır ve ürünün tek üstünlüğünü yok eder. Ayrım:

| ne | kaç mesaj | neden |
|---|---|---|
| **Sayım** — kim kaç yazdı, kaç soru, kaçı döndü | 10 | Sohbette gerçekten olanın sayılması. Çıkarım değil, tarif |
| **Denge / asimetri** | ~30 | Oran anlamlı olsun diye |
| **Gecikme medyanı ve asimetrisi** | ~100 cevap/taraf | Medyanın güven aralığı taşınabilir olsun diye |
| **Trend** | ~150 | Eğim gürültüden ayrılsın diye |
| **Kırılma tarihi + CI** | 500 / 60 gün | Değişim noktası küçük n'de her yerde kırılma bulur |

Az veride sayım söylenir, trend ve tarih **sessizce atlanır**. Ret ekranı yok.

**Bu fazın sinyalleri** (10 mesajda geçerli olan tek grup, katalogdaki Katman 1):

1. **Yanıt doyuruculuğu** — cevap konuya giriyor mu, kapatıyor mu
2. **Soru resiprositesi** — kim soruyor, kaçı dönüyor, takip sorusu var mı
3. **Efor asimetrisi** — uzunluk + başlatma + gecikme + soru, tek indeks

**Ödül hilesi uyarısı.** "Az mesajda da dolu olsun" hedefini eşik düşürerek
tutturmak bu fazın en olası hilesidir. `honesty.js` eşiklerinde gerekçesiz
değişiklik = KALDI.

```
KULLANICI CÜMLESİ : 12 mesajlık sohbetimi verdim, üç cümle geri aldım.
KABUL KOMUTU      : node train/az_veri_check.mjs
                    (yazılacak: 10/30/100/150/500 mesajlık sentetik sohbetler,
                     her birinde üretilen desen sayısı ve tipi)
EŞİK              : 10 mesajda ≥ 2 desen · 10 mesajda trend/tarih deseni = 0 ·
                    500 mesajda tarih deseni ≥ 1
DOKUNULABİLİR     : web/js/{balance,features}.js, web/js/time/{signals,honesty}.js, train/
```

---

## S6 · "SOHBETİN ZAMANINI OKUYOR"

**Kullanıcı cümlesi.** Uzun sohbetimde ne zaman değiştiğini söyledi.

**Bu fazın sinyalleri** (Katman 1-2):

1. **Açılma derinliği asimetrisi** + genişlik/derinlik seyri
2. **Frekans düşüşü trendi** → mevcut değişim noktası motoruna bağlanır
3. **biz/ben oranı ve seyri**

**biz/ben: regex ile tam çözülmez.** Türkçe sondan eklemeli; "seçim" ile
"gittim", "bizim" ile "biziz" ayrımını düz desenle %100 yapmak imkânsız. Elde
NLP kütüphanesi yok. Ajan bunu zorlarsa ya kilitlenir ya %40 hatalı bir sinyal
bırakır.

**Kural: yüksek kesinlik, düşük kapsama.** Yalnızca tartışmasız yüzey
biçimleri (`biz, bize, bizim, bizi` / `ben, bana, benim, beni`) ve yüksek
frekanslı, kapalı bir fiil listesinde birinci tekil/çoğul ekleri. Şüpheli olan
sayılmaz.

**Kesinlik kapısı.** Elle etiketlenmiş 200 mesajlık örneklemde kesinlik
ölçülür. **%90'ın altındaysa bu sinyal ertelenir ve karta çıkmaz.** Yanlış
sinyal, eksik sinyalden kötüdür.

**Kanıt notu.** biz/ben için: Karan/Rosenthal/Robbins 2019 meta-analizi (30
çalışma, ~5.300 kişi); Seraj/Blackburn/Pennebaker 2021 PNAS (6.803 Reddit
kullanıcısı, 1.027.541 gönderi — "ben" ayrılıktan ~3 ay önce yükseliyor). Ama
PNAS bulgusu **kişisel gönderilerde**, çift içi yazışmada değil. Belirti, sebep
değil.

Frekans düşüşü için: Garimella 2014 (661 ayrılan çift, açık Twitter verisi;
tek taraflı susma ayrılanların %38'inde, kontrolde %10). **Ayrılık öncesi
"mesaj kısalır, gecikme artar, soru azalır" iddiasının hakemli günlük verisinde
doğrulaması YOK** — flört blogları söylüyor, literatür söylemiyor.

```
KULLANICI CÜMLESİ : 800 mesajlık sohbetimde bir tarih gördüm, yanında da aralığı.
KABUL KOMUTU      : node train/zaman_sinyal_check.mjs && node train/prodrop_kesinlik_check.mjs
EŞİK              : üç sinyal de üretiliyor · biz/ben kesinliği ≥ %90
                    (altındaysa sinyal kapalı ve karta çıkmıyor, bu da GEÇTİ'dir)
DOKUNULABİLİR     : web/js/time/, train/
```

---

## S7 · "ÜÇÜ BİRDEN AYNI DÖNEMDE DÖNDÜ"

**Kullanıcı cümlesi.** Tek tek değil, birkaç şeyin aynı anda değiştiğini gösterdi.

**En sert desen tipi bu.** Tek sinyal tesadüf olabilir, üçünün birlikte dönmesi
olamaz. Ama `web/js/time/signals.js` sinyalleri ayrı ayrı üretiyor, "hangileri
aynı dönemde döndü" diye gruplamıyor.

**Eşzamanlılık formülü — ajana bırakılmaz, burada yazılı.**

Ajan "aynı dönem"i takvim haftasıyla kodlarsa saçmalar: sohbetler patlamalıdır
(bir ay sessizlik, bir gün 500 mesaj), takvim penceresi boş dizi ve sıfıra
bölme üretir. Ayrıca gerçek veride frekans salı, cevap uzunluğu cuma döner;
`tarih1 == tarih2` hiçbir zaman tutmaz ve bu desen **asla tetiklenmez**.

Doğrusu şu ve zaten elimizde: değişim noktası motoru her sinyal için bir tarih
**ve bir güven aralığı** üretiyor (residual bootstrap). O halde:

> **İki sinyal eşzamanlıdır ⟺ güven aralıkları kesişiyorsa.**
> Üç sinyal eşzamanlıdır ⟺ üçünün aralığı ortak bir noktada kesişiyorsa.

Takvim yok, sabit pencere yok, keyfi eşik yok. Belirsizliği zaten ölçmüş olan
makineyi kullanıyor: az veriyle aralık genişler, iddia kendiliğinden zorlaşır.

Kenar durumlar, açıkça:
- Bir sinyalin aralığı `ciDaysMax` (60 gün) sınırını aşıyorsa eşzamanlılığa **girmez**
- Sohbette hiç kırılma yoksa bu desen üretilmez, hata değildir
- Sessiz dönemler oturum bölütlemesinden zaten geçiyor, ham takvim günü kullanılmaz

**Bu fazın ikinci yarısı: Katman 3 betimleyicileri.**

1. **"biz neyiz" sorulmuş mu, cevaplanmış mı** — ilişkiyi tanımlama konusunu
   içeren mesajlar sayılır; açıldıysa cevaplandı mı, savuşturuldu mu.
   Kullanıcının asıl sorusu bu ve ölçülebilir.
2. **Kesintili temas** — uzun sessizlikler + kısa geri dönüşler.
   **"Breadcrumbing" DENMEZ** — o bir niyet iddiasıdır ve literatürde neredeyse
   hiç ampirik desteği yoktur (benching, cushioning, orbiting de öyle).
3. **Hitap kayması** (sen/siz, isim, lakap) — Türkçeye özgü, batı literatüründe yok
4. **Değer verme ifadesi asimetrisi** — teşekkür, takdir, hal hatır sorma

**Türkçe kalibrasyon, zorunlu.** Bu bulguların neredeyse tamamı batı
örnekleminden: Henrich/Heine/Norenzayan 2010 — psikoloji örneklemlerinin %96'sı
dünya nüfusunun %12'sini temsil eden ülkelerden; Arnett 2008 — deneklerin %68'i
ABD'den. Türkçe daha dolaylı ve yüksek bağlamlı; itiraz yumuşatılır ("galiba",
"herhalde"), sessizlik nezaket olabilir. Ama tek yönlü değil: Marti 2006 Türkçe
tek dillilerin Türk-Alman iki dillilerden **daha doğrudan** rica stratejileri
seçtiğini bulmuş.

Sonuç: doğrudanlığa dayalı sinyaller yanlış okunabilir. Eşikler Türkçe veriyle
kurulur ve **karşılaştırma evrensel norma değil, çiftin kendi geçmişine göre**
yapılır.

```
KULLANICI CÜMLESİ : Üç şeyin aynı dönemde değiştiğini söyledi, tek tek saymadı.
KABUL KOMUTU      : node train/eszamanlilik_check.mjs
                    (sentetik: üç sinyali aynı döneme ek, yakalandı mı;
                     ayrı dönemlere ek, yakalanmadı mı)
EŞİK              : ekilen eşzamanlılık yakalanıyor · ayrık sinyallerde
                    yanlış pozitif = 0 · ciDaysMax aşan sinyal gruba girmiyor
DOKUNULABİLİR     : web/js/time/signals.js, web/js/time/analyze.js, train/
```

---

## S8 · "CÜMLELER İNSAN AĞZINDAN ÇIKMIŞ"

**Kullanıcı cümlesi.** Okuduğum cümle bir dashboard değil, biri beni izliyormuş gibi.

**ÖNCE BİR ÇELİŞKİ ÇÖZÜLÜYOR.** S3'ten sonra buluta **sadece sayı** gidiyor.
Yani LLM sohbeti okumuyor. "Sohbetin haline göre şarkı seç" cümlesi bu yüzden
yanlıştı: modelin göreceği tek şey desenler ve sayılardır.

Doğrusu: **LLM şarkıyı desen kombinasyonuna göre seçer.** Girdi "tek taraflı,
frekans düştü, sorular karşılıksız" gibi bir tablodur.

Bunun bilinen bedeli: girdi düşük boyutlu olduğu için **şarkı havuzu tekrara
düşer.** Benzer desenli sohbetler benzer şarkıyı alır; iki arkadaş aynı kartı
görürse etki ölür. S13'te ölçülecek: ilk 200 okumada kaç farklı şarkı çıktı.

**İş.**

1. Katalogdaki sinyaller `SPIKER_SYSTEM`'e girer. Teşhis/nedensellik/tahmin
   yasağı **tüm akışa** yayılır (şu an `ZAMAN_SYSTEM`'de tam, `SPIKER_SYSTEM`'de
   kısmi).
2. Şarkı alanı + doğrulama.
3. Sağlayıcı bağımsızlığı.

**Şarkı.** Llama desen kombinasyonuna göre **gerçek** bir şarkı seçer, liste
yok, kısıt yok. Sonra **ikinci bir çağrı** temiz bağlamda, sıcaklık 0 ile
doğrular: "bu şarkı var mı, bu sanatçının mı?" Geçemezse şarkı düşer, okuma
çıkar. Şarkı **sözü yasak**, sadece ad + sanatçı (telif). Bu, `quoteIsInDoc`'un
alıntı için yaptığının şarkı versiyonu. Yakalama %100 değil, kabul edilmiş risk.

**Doğrulama okumayı bekletmez.** Okuma gelir gelmez basılır, şarkı arkada
doğrulanır, geçerse kartta belirir. Kart üretimi şarkıyı beklemez.

**Ama gecikme tek maliyet değil: dakika limiti.** Groq ücretsiz katman **30
istek/dakika**. Okuma 1 + şarkı doğrulama 1 = kullanıcı başına 2 istek =
dakikada ~15 eşzamanlı kullanıcı. Instagram trafiği gruplar halinde gelir.
Günlük 100 sayacı bunu çözmez; sayaç günü korur, dakikayı korumaz.

İki seçenek, hakem seçer:
- **Loop kalır** → viral dakikalarda okuma da şarkı da 429 yer
- **Doğrulama ücretsiz müzik aramasına taşınır** (iTunes Search API:
  anahtarsız, ücretsiz, ~200 ms) → LLM bütçesi sadece okumaya harcanır,
  dakikada ~30 kullanıcı, ve şarkının varlığı LLM kanaatiyle değil kayıtla
  cevaplanır

Karar kuralı: `/api/spiker` 429 oranı %5'i geçerse doğrulama LLM'den çıkar.

**Sağlayıcı.** Model Llama (`llama-3.3-70b`). Host değişken: `LLM_URL`,
`LLM_MODEL`, `LLM_API_KEY`. Boşsa Groq'ta kalır; `GROQ_API_KEY` eski adıyla
çalışmaya devam etmeli, canlı worker bozulmasın.

```
cerebras    https://api.cerebras.ai/v1/chat/completions      llama-3.3-70b
together    https://api.together.xyz/v1/chat/completions     meta-llama/Llama-3.3-70B-Instruct-Turbo
openrouter  https://openrouter.ai/api/v1/chat/completions    meta-llama/llama-3.3-70b-instruct
```

Groq çalışanlarının ~%90'ı NVIDIA'ya geçti (Aralık 2025); GroqCloud'un geleceği
belirsiz. Model Llama olduğu sürece host ürünü değiştirmez.

**Maliyet.** Ücretsiz katman 1000 istek/gün, 100k token/gün. Ücretli 1M token
başına 0.59/0.79 dolar; okuma başına kabaca 0.001 dolar. `ZAMAN_GUNLUK`
**100 kalıyor** ve **ekranda görünüyor**. 100/gün × 30 ≈ ayda birkaç dolar.

**Not.** Sağlayıcı değişkeni ve şarkı loop'u bir kez prototiplendi ama **repoya
girmedi, hiçbir yerde durmuyor.** Bu fazın ajanı ikisini de sıfırdan yazar.

```
KULLANICI CÜMLESİ : Cümleyi okudum, biri beni izliyormuş gibi hissettim, ve şarkı gerçekti.
KABUL KOMUTU      : node backend/tests/spiker_yasak_check.mjs && node backend/tests/sarki_dogrulama_check.mjs
EŞİK              : 50 sentetik okumada — rakam sızıntısı = 0 · teşhis kelimesi = 0 ·
                    nedensellik cümlesi = 0 · doğrulanmamış şarkı karta çıkmıyor
DOKUNULABİLİR     : backend/worker.js, backend/tests/, web/js/api.js, backend/wrangler.toml
```

---

## S9 · "SAYAÇ DOLMUŞTU AMA FARK ETMEDİM"

**Kullanıcı cümlesi.** Sayaç dolduğu bir gün girdim ve kötü bir şey almadım.

**Neden ayrı bir faz.** Sayaç dolduğunda, worker düştüğünde ya da rıza yokken
ürün buraya düşüyor. Viral saatte gelenlerin **çoğu bu yolu görecek** ve ürün
hakkındaki kanaat oradan oluşacak. Şablon "yedek" değil, ikinci ana yol.

**Basit bir if-else havuzu yetmez.** Kullanıcı altı adımda dosya çıkarıp
geldiyse ve karşısına cansız bir kalıp cümle çıkarsa aradaki kalite farkını
anında hisseder. Şablonlar, LLM'in yazacağı cümlenin **deterministik yansıması**
olacak kadar iyi olmalı.

**İş.**

1. Her desen kalıbı (A-E) için çok sayıda önceden yazılmış varyant; seçim
   sayılara göre deterministik — aynı sohbet aynı cümleyi verir
2. Aynı kartta aynı kalıbın iki kez çıkmaması, ardışık okumalarda tekrar hissi olmaması
3. Ses denetimi: küçük harf, em dash yok, teşhis yok, nedensellik yok

```
KULLANICI CÜMLESİ : Kapasite doluymuş, ben anlamadım bile.
KABUL KOMUTU      : SPIKER_OPEN=off node train/sablon_kalite_check.mjs
EŞİK              : worker kapalıyken okuma tamamlanıyor · "kapasite" hata
                    ekranı = 0 · 200 sentetik sohbette benzersiz cümle oranı
                    ≥ %80 · ses ihlali (büyük harf, em dash, teşhis) = 0
DOKUNULABİLİR     : web/js/{reveal,zamanYazi,soz}.js, train/
```

---

## S10 · "KARTIM ORADA"

**Kullanıcı cümlesi.** Sonucu gördüm ve hikayeye atmak istedim.

**⛔ İKİNCİ SERT DURAK. `GIRDI/kart/cizim.*` yoksa faz durur.**

**Damla'nın dolduracağı**

```
GIRDI/kart/
  cizim.*          kart içi yerleşim, görsel imza, son paylaşım kartı
```

**Görsel imza zorunlu.** Wordle'ın yeşil/sarı kareleri bir ikonografi yarattı:
insanlar gridi görünce ne olduğunu anlıyordu. "9:16, siyah, JetBrains Mono" tek
başına bunu vermez — Instagram'daki herhangi bir alıntı sayfasından ayrılmaz.
Bir bakışta tanınan bir işaret olmalı: tekrar eden bir yerleşim, bir işaret,
bir ritim. Çizim bunu içermeden faz başlamaz.

**Kart canvas'a ELLE çizilmez.** Ajan, canvas'a metin yazarken kördür: satır
kaydırma, font ölçüsü ve hiyerarşi tek seferde tutmaz, metinler üst üste biner.
Hakem de çıktıyı göremez, sadece JS'e bakıp "tamam" der. Sonuç: canlıda taşmış
bir kart.

**Bu yüzden kart önce HTML/CSS olarak kurulur**, tarayıcı satır kaydırmayı ve
ölçüleri kendisi hesaplar; paylaşım görseli o DOM'dan üretilir. Böylece Damla
kartı canlıda gözüyle görebilir ve ajan metin ölçüsü tahmin etmek zorunda kalmaz.

**Kart içeriği**

```
9:16, siyah, JetBrains Mono
desen cümleleri (2-3)
şarkı: ad + sanatçı
eğlence içindir. sevmek güzeldir. <3
seviyorsevmiyor

SOHBET METNİ YOK · İSİM YOK · LİNK YOK
```

**Neden linksiz.** Wordle dersi: kart sonucu gösterir, cevabı vermez. Linksiz
olduğu için algoritma bastırmaz ve izleyici kendi sohbetini denemek zorunda kalır.

```
KULLANICI CÜMLESİ : Kartımı gördüm ve indirdiğim görsel ekrandakiyle aynıydı.
KABUL KOMUTU      : test -f GIRDI/kart/cizim.* && node web/tests/kart_render_check.mjs
EŞİK              : çizim var · kart DOM'da render oluyor · indirilen görsel
                    ile DOM ölçüleri farkı ≤ 2px · taşan metin = 0 ·
                    kartta sohbet metni/isim/link = 0
DOKUNULABİLİR     : web/js/share.js, web/css/, web/tests/, GIRDI/kart/
```

---

## S11 · "KARTI PAYLAŞTIM"

**Kullanıcı cümlesi.** Desenleri tek tek gezdim, sonunda tek karta bastım ve hikayeye attım.

**Akış: Wrapped gibi.** Desen başına bir kart, **dokunarak** ilerler, otomatik
akmaz. Sonda tek paylaşım kartı.

**Neden dokunarak.** Kullanıcı kendi hızında okur; otomatik akış duygusal
vuruşu keser.

**Paylaşım.** Web Share API, mobilde doğrudan Story'e. `share.js` bu akışa
bağlanır — bugün zaman akışına hiç bağlı değil, viral yüzey tamamen eksik.

```
KULLANICI CÜMLESİ : Telefonumda baştan sona gezdim ve tek dokunuşla paylaştım.
KABUL KOMUTU      : node web/tests/paylasim_akis_check.mjs
EŞİK              : desen sayısı kadar kart üretiliyor · geçiş dokunmayla ·
                    Web Share API çağrısı DOM'da mevcut · son kart tek
DOKUNULABİLİR     : web/js/{ui,reveal,share}.js, web/tests/
```

---

## S12 · "YABANCI KULLANDI VE PAYLAŞTI"

**Kullanıcı cümlesi.** Tanımadığım biri girdi, sohbetini bıraktı, kartını paylaştı.

**⛔ ÜÇÜNCÜ VE EN SERT DURAK. Bu koşunun tek gerçek kabul testi.**

Diğer on üç fazın hepsi bunun önkoşulu.

72 sürüm boyunca ürün "canlı" oldu ama kimse kullanmadı. Kapılar yeşil yandı,
motor tarayıcıda hiç koşmadı, tek bir kart paylaşılmadı. "Ölçtük" bir faz
çıktısı değildir kuralının en pahalı ihlali bu.

**İş.**

1. Damla değil, **tanımadığı ya da projeyi bilmeyen** en az 3 kişi.
2. Zincir uçtan uca koşar: siteye gir → sohbeti bırak → desenleri oku → kartı al.
3. Ölçülen:
   - Kaç adımda düştüler? (giriş → bırakma → sonuç → paylaşım)
   - "?" penceresini açtılar mı, açmadan yapabildiler mi?
   - Export mı, ekran görüntüsü mü, yapıştırma mı seçtiler?
   - Kartı **gerçekten** paylaştılar mı? Paylaşmadılarsa neden?
   - Okudukları cümle onlara doğru geldi mi? Hangi cümle yanlış geldi?
4. Sonuç bu dosyaya yazılır. **Hiçbir sayı bu ölçümden sonra "yaklaştırmak
   için" değiştirilmez.** Bir şey tutmuyorsa hangi fazın kartı yanlıştı sorulur,
   o faz yeniden koşar.
5. Tutmayan her nokta için bir düzeltme maddesi üretilir ve S14'e girer.

**Damla'nın dolduracağı**

```
GIRDI/yabanci/
  rapor.md         3 kişi, yukarıdaki beş soru
  ss-*.png         paylaşılan kartların ekran görüntüsü
```

**Kural.** S13 ve S14 bu faz geçmeden koşamaz. Kimsenin kullanmadığı bir ürünü
pazarlamak, 72 sürümün tekrarıdır.

```
KULLANICI CÜMLESİ : Beni tanımayan biri girdi ve kartını paylaştı.
KABUL KOMUTU      : eşik YOK, bu bir gerçeklik fazı.
                    test -f GIRDI/yabanci/rapor.md && grep -c "^KISI" GIRDI/yabanci/rapor.md
EŞİK              : ≥ 3 kişi · en az 1'i kartı gerçekten paylaştı ·
                    paylaşmayanların gerekçesi yazılı.
                    0 kişi ise koşu DURUR.
DOKUNULABİLİR     : KOSU-v1.md, GIRDI/yabanci/
```

---

## S13 · "KAÇ KİŞİ GELDİ, KAÇI PAYLAŞTI"

**Kullanıcı cümlesi.** (Bu faz Damla için, kullanıcı için değil.)

**Teşhis.** `/api/ping` sayaçları ve `panel.html` var ama huni yok. Kaç kişi
girdi, kaçı yapıştırdı, kaçı sonuç gördü, kaçı paylaştı — hiçbiri bilinmiyor.

**Başarı metriği: paylaşım oranı.** Tek seferlik ürün, tek döngü paylaşım.

**İş.**

1. Huni: giriş → yapıştırma → sonuç → paylaşım. `panel.html`'e bağlanır.
2. **Şarkı çeşitliliği** ölçülür (S8'in açık borcu): ilk 200 okumada kaç farklı
   şarkı çıktı? 20'nin altındaysa prompt'ta çeşitlilik zorlanır ya da özellik
   gözden geçirilir.
3. **Kıtlık deneyi.** Günlük 100 sayaç, ekranda görünür. Tez: sınır olunca
   insanlar o gün girmek ister, her gün tekrarlar. İki hafta ölç:
   - tekrar gelen ziyaretçi oranı (tez doğruysa yükselir)
   - sayaç dolduktan sonra gelenlerin paylaşım oranı
   - sayaç dolmadan gelenlerinki (kıyas)

   Dolduktan sonraki paylaşım oranı belirgin düşükse sayı yükseltilir.
4. **Domain.** `canonical`, `og:url`, `sitemap.xml`, `robots.txt` hepsi
   `seviyorsevmiyor.noseydewdrop.com` diyor ama `web/` altında CNAME yok. Link
   önizlemeleri ve SEO ölü adrese gidiyor. Ya CNAME + DNS, ya hepsi github.io'ya
   döner — şu an ikisinin de en kötüsü.
5. **CI.** `pages.yml` sadece deploy ediyor. Altı kapı + parity koşacak.
6. **Cache-busting.** Elle `sed` yerine commit SHA. v61'de dinamik import dahil
   tüm JS cache'te dondu; aynı hata sınıfı kapansın.

```
KULLANICI CÜMLESİ : Panele baktım, dün kaç kişinin paylaştığını gördüm.
KABUL KOMUTU      : node web/tests/huni_check.mjs && curl -sI $(grep -o 'https://[^"]*' web/index.html | head -1) | head -1
EŞİK              : dört huni adımı da sayılıyor · panel dördünü gösteriyor ·
                    canonical adresi 200 dönüyor · CI'da altı kapı koşuyor
DOKUNULABİLİR     : backend/worker.js, web/panel.html, web/index.html,
                    web/sitemap.xml, .github/workflows/pages.yml, web/tests/
```

---

## S14 · "VİTRİN GERÇEĞİ SÖYLÜYOR"

**Kullanıcı cümlesi.** Siteye giren biri ne aldığını anlıyor, ve LinkedIn'de
anlatacak bir hikâye var.

**⛔ S12 geçmeden koşamaz.**

**Bayat veri.** Ana sayfa bugün "flört var mı, yok mu" diyor ama ürün artık
desen kombinasyonu veriyor. `og.png` hâlâ terazi+kalp. `zaman.html`'de sıfır OG
etiketi vardı (S4'te kalktı). README yok.

**İş.**

1. Landing'deki her iddia motordan doğrulanır. Elle yazılmış, kodla
   desteklenmeyen cümle sıfır.
2. **README + ölçüm tablosu.** 29 repoluk portfolyonun en teknik projesinde
   README yok. Ölçümler (yanlış pozitif %0, güç %75, kapsama %89.3, 39.5k mesaj
   686 ms) orada durmalı.
3. **`og.png`** — Damla'nın işi, `og.svg`'den elle 1200x630 export. Ajan bu
   dosyayı yazamaz. Faz bunsuz kapanmaz.
4. **İçerik hasadı.** HASATÇI ajan bir kez çalışır, kod yazmaz. Bütün devir
   paketlerini ve S12 raporunu okur, `devlog.md` + `linkedin.md` girişlerini
   tek seferde çıkarır.

**İçerik faz işi değildir.** Yapıcılara içerik görevi verilmez: odağı böler ve
faz ortasında yazılan içerik genelde yanlış olur, çünkü işin nasıl bittiği
henüz belli değil. Devir paketleri zaten ham madde: ne değişti, neden, altındaki
karar ne. "Her giriş gerçek geçmişten gelir" kuralı böylece kendiliğinden sağlanır.

**Konumlandırma, rakip boşluğundan ölçülmüş.**

Rakipler — Lucen (ilgi skoru, ghost riski), AfterMatch (GHOST_RISK 85, DELULU
ölçeği, HEALTH 92/100, roast/coach modu), Red Flag: Cringe (cringe skoru, rizz,
Chat Wrapped), Red Flag AI (20+ red flag türü), Selka. Hepsi abonelikli, hepsi
sohbet metnini ABD buluta yolluyor.

| onlar | bu ürün |
|---|---|
| skor verir | desen verir |
| öğüt verir | vermez |
| 3 ekran görüntüsünden kesin hüküm | ölçtüğünü söyler, ölçemediğini söylemez |
| metni buluta yollar | yollamaz |
| abonelik | ücretsiz |
| İngilizce öncelikli | Türkçe |

**LinkedIn tohumu.** Oradaki kitle "flört var mı" için gelmez, **motor için**
gelir. Ama en güçlü hikâye motor bile değil: **modelin uydurmasının kullanıcıya
nasıl ulaşamadığı.** `quoteIsInDoc`, `zamanGecerli`, `olguTemiz`, şarkı loop'u —
dördü de gerçek bir hatadan doğdu, dördü de kodda duruyor. Prompt mühendisliği
yazısı değil, LLM güvenilirlik mimarisi yazısı. O alanda yazan az.

Gelen kişi kendi sohbetini dener, kart Instagram'a düşer. LinkedIn yakıt,
Instagram ateş. Yerel kanal: Instagram Hikaye (test/anket çıkartması kültürü),
grup sohbeti.

**Hukuk, üç madde, hepsi yazılı olacak.**

1. **Sohbetteki karşı taraf rıza vermedi.** KVKK'ya göre kişisel veri kural
   olarak açık rıza olmadan işlenemez; verinin üçüncü kişiden elde edilmiş
   olması tek başına hukuki dayanak sağlamaz (Kurul kararları ve Temmuz 2026
   kamuoyu duyurusu). On-device yapı bu riski büyük ölçüde ortadan kaldırıyor
   çünkü veri hiç aktarılmıyor — **S3 kapandıysa.**
2. **Eğlence amaçlıdır** ibaresi kartta ve `kosullar.html`'de.
3. **18 altı.** Hedef kitle gen-z; yaş politikası yazılır.

**Pazarlamanın tek koşulu.** S12 geçmeden hiçbir pazarlama cümlesi yazılmaz.
Bugünkü ana sayfanın gerçeği söylememesinin sebebi bu sıranın tersine işlemiş
olması.

```
KULLANICI CÜMLESİ : Siteye girdim, ne aldığımı anladım; LinkedIn'de de hikâyeyi okudum.
KABUL KOMUTU      : node web/tests/vitrin_gercek_check.mjs && test -f README.md && grep -c "686\|89.3\|%75" README.md
EŞİK              : desteklenmeyen iddia = 0 · ölü link = 0 · README var ve
                    ölçüm tablosu taşıyor · og.png güncel · devlog girişi ≥ 5
DOKUNULABİLİR     : web/index.html, README.md, devlog.md, linkedin.md,
                    web/kosullar.html, web/tests/
```

---

## SIRA VE BAĞIMLILIK

```
S1  Depo temiz + sızıntı      → bağımsız, ilk, context ekonomisi
S2  Worker sertleştirme       → S1
S3  Ham metin kapat           → S2. Ürünün tek iddiasını doğru yapan faz
S0  Tarayıcı masası (DAMLA)   → S1..S3'ten sonra  ⛔ rapor.md yoksa S4 DURUR
S4  Tek sayfa                 → S0, S3
S5  Sayım sinyalleri          → S4. 10 mesajda geçerli tek grup
S6  Zaman sinyalleri          → S5
S7  Eşzamanlılık + Türkçe     → S5, S6
S8  Prompt + şarkı            → S3, S7
S9  Şablon motoru             → S8. Viral saatte çoğunluk bunu görecek
S10 Kart                      → S9  ⛔ GIRDI/kart/cizim.* yoksa DURUR
S11 Akış ve paylaşım          → S10
S12 YABANCI KULLANDI          → S11  ⛔ Bu geçmeden S13 ve S14 koşamaz
S13 Ölçüm + dağıtım           → S12
S14 Vitrin + içerik hasadı    → S12, S13
```

S5 ve S6 sıralı ama S7 ikisine birden bağlı: eşzamanlılık, her iki grubun da
değişim noktası çıktısını kullanıyor.

**Üç sert durak var.** S0'da tarayıcı raporu yoksa koşu durur. S10'da çizim
yoksa durur. S12'de kimse kullanmadıysa durur. Üçü de Damla'yı bekler; birincisi
bir akşamlık, ikincisi bir çizim, üçüncüsü üç kişiye link atmak.

**S0 ve S12 farkı.** S0 "teknik olarak koşuyor mu" diye bakar, n=1, Damla'nın
kendi telefonu. S12 "biri gerçekten kullanır mı" diye bakar, n≥3, yabancı.
Koşmak hedef değil, kullanılmak hedef.

---

## SES

Kart, ekran ve şablon metinlerinin tamamı.

küçük harf. mesafeli gözlemci. şaka yok, öğüt yok, teşhis yok.
em dash yok. sorular "?" ile biter. "kanka" yok. metafor, slogan, emoji yok.
her cümle geçmiş ya da şimdiki zamanda, nedensellik cümlesi olmadan.

Referans ton: theyseeyourphotos (Ente'nin fotoğraf gizliliği projesi) — tanıdık
bir şeyi yabancının gözünden soğukkanlılıkla geri okumak. The Pudding'in Spotify
botu — veriyi anlatma, veriye tepki ver.

### Desen dili kuralları

- **İki zamanı kıyasla.** Tek fotoğraf değil, hareket: "önce X, şimdi Y"
- **Sayı ver ama yorumlama.** "7 soru, 3 cevap" yazılır; "ilgisiz" yazılmaz
- **Birlikte değişenleri grupla.** Üç ayrı satır değil, "üçü birden döndü" tek satır
- **Sebep yok.** "Neden" boşluğunu kullanıcı doldurur
- **Çiftin kendi geçmişine göre konuş**, evrensel norma göre değil

### Cümle kalıpları

**A — çıplak sayım**
> sen 7 soru sordun. 3'ü döndü.
> planı 4 kere sen kurdun. o sıfır.

**B — önce/sonra** (kırılma varsa)
> eskiden 4 dakikada dönüyordu. şimdi 6 saatte.
> mesajları yarı yarıya kısaldı.

**C — eşzamanlılık**
> cevaplar kısaldı. süreler uzadı. başlatma sana geçti. üçü de aynı dönemde.

**D — çelişki**
> tatlı yazıyor ama plan kurmuyor.
> hep cevap veriyor, hiç başlatmıyor.

**E — eksik olan**
> sana bir kere bile nasılsın dememiş.
> 200 mesaj oldu, buluşma teklifi yok.

**C ve E en sert olanlar.** C tesadüf olamayacak kadar çok şeyin aynı anda
dönmesi; E kullanıcının fark etmediği boşluk. Kartta öncelik bu ikisinde.

### Örnek satırlar

```
sen üç mesaj yazıyorsun, o bir. bu baştan beri böyle değildi.
sorular hep senden geliyor. sana en son ne zaman bir şey sordu?
açıldığın yere kısa dönüyor. sonra konuyu değiştiriyor.
ilk aylarda 'biz' diyordunuz. son haftalarda sadece 'ben' var.
cevap süresi giderek uzuyor. sen hemen yazıyorsun, o ertesi gün.
konuşmayı hep sen başlatıyorsun. o başlatmıyor, sadece cevap veriyor.
bir şey anlatıyorsun, 'hı' diyor. konuşma orada duruyor.
ne olduğunuzu iki kere sordun. ikisinde de başka bir şeye kaydı.
sessizlikler uzuyor, sonra kısa bir mesajla geri geliyor. sonra yine sessizlik.
mesaj sayısı temmuzda düştü. o tarihten sonra aynı değil.
sana bir kere bile nasılsın dememiş.
```

---

## YASAKLAR

Pazarlık yok. Hiçbiri "yumuşatılmış haliyle" de yazılmaz. Bunlar S8'in
promptunda, S9'un şablonlarında ve S10'un kartında aynen geçerli.

| yasak | neden |
|---|---|
| Bağlanma stili ("kaçıngan", "kaygılı") | Gizli içsel yapı, ölçekle ölçülür, ilişkiye ve bağlama göre değişir, metinden okunmaz |
| Teşhis ("narsist", "manipülatif", "depresyonda") | Klinik değerlendirme gerektirir; dil korelasyonları toplum düzeyinde, birey teşhisi değil |
| Aldatma iması | Hiçbir metin deseni tanısal değil, taban oran düşük, her "işaret"in masum açıklaması var. Ayrıca iftira |
| Gelecek tahmini, olasılık | En iyi ilişki bilimi zengin anketle bile kalitenin yarısından azını açıklıyor (Joel 2020 PNAS, 43 veri seti, 11.196 çift: başlangıçta %45, bitişte %18) |
| "Seni seviyor mu" | İçsel durum. Efor ve doyuruculuk en fazla vekil |
| Nedensellik ("sıkıldı", "biriyle tanıştı") | Üçüncü değişkenler görünmez: sınav, hastalık, iş, başka ilişki. Motor **ne zaman** değiştiğini gösterir, **neden**ini asla |
| Gottman'ın %90 boşanma tahmini | Çapraz doğrulama yok. Heyman & Slep 2001 (JMF 63:473-479, 528 kişi): aynı yöntem taze yarıda %29 pozitif kestirim değerine düşüyor, genel doğruluk %69 |
| LSM'yi uyum göstergesi yapmak | Ireland 2011 (86 çift, OR=1.95) beş laboratuvarlı ön kayıtlı replikasyonda düştü: Bierstetel 2020, 383 çift/766 kişi, memnuniyetle r≈.10 sınırda, bağlılıkla r≈.05 anlamsız. Bowen 2017 yüksek LSM'nin çatışmada daha kötü davranışla gittiğini buldu |
| "Breadcrumbing", "benching", "orbiting" | Niyet iddiası. Literatürde neredeyse hiç ampirik desteği yok. Desen tarif edilir, motive ad verilmez |

**Rakiplerin sattığı şey tam olarak bu yasaklar.** Ürünün güvenilirlik
üstünlüğü onları reddetmesinden geliyor.

---

## SİNYAL KATALOĞU

S5 · S6 · S7'nin kapsamı. Her sinyal: ne ölçülür, kanıt ne kadar sağlam, ne
iddia edilebilir. **Bu fazların ajanları iki araştırma raporunu da okur** —
buradaki özet onların yerini tutmaz.

### Katman 1 — kanıtı en güçlü (S5, S6)

**1. Yanıt doyuruculuğu.** Cevap önceki mesajın içeriğine giriyor mu (ortak
kelime, konu devamı, takip sorusu), yoksa genel bir onay mı ("hı", "ok")?
*Kanıt:* Algılanan eş duyarlılığı (Reis, Clark & Holmes 2004) literatürünün
davranışsal karşılığı.
*Sınır:* Karşıdakinin ne hissettiğinin kanıtı değil. "o seni anlamıyor" denmez;
"mesajlarına aynı konuyla dönmüyor" denir.

**2. Soru resiprositesi.** Kim soruyor, kaçı dönüyor, açılmadan sonra takip
sorusu geliyor mu.
*Türkçe uyarısı:* Yüksek bağlamlı kültürde az soru ilgisizlik değil, norm olabilir.

**3. Açılma derinliği asimetrisi.** Mesajlar üç derinliğe ayrılır (nötr bilgi /
tercih-duygu / kişisel-mahrem), iki taraf kıyaslanır. Ayrıca zaman içinde
**genişlik sabit ama derinlik düşüyor** mu (geri çekilme imzası).
*Kanıt:* Altman & Taylor 1973; Collins & Miller 1994 meta-analizi (94 çalışma,
r≈.18–.20); Tolstedt & Stokes 1984.
*Sınır:* Derinlik sınıflaması gürültülü ve kültüre bağlı.

**4. Efor asimetrisi.** Uzunluk + başlatma + gecikme + soru, tek indekste.
*Kanıt:* Yatırım modeli (Rusbult 1980; Le & Agnew 2003 meta 52 çalışma/11.582
kişi; Tran 2019 202 örneklem/~50.000).
*Sınır:* Efor farkı ilgi farkının **vekili**, kanıtı değil. Flört tespiti zaten
zor: Hall/Xing/Brooks çalışmasında yabancı çiftler karşısındakinin flört
ettiğini yalnızca %28 doğrulukta anlamış (kadınlar erkeklerinkini %22).

**5. Frekans düşüşü trendi.**
*Kanıt:* Garimella 2014 (661 ayrılan çift; tek taraflı susma ayrılanların
%38'inde, kontrolde %10).
*Sınır:* Açık sosyal medya verisi, özel mesajlaşma değil, nedensel değil.

### Katman 2 — sağlam ama uyarılı (S6)

**6. biz/ben oranı ve seyri.** Türkçe pro-drop; ek yapısı çözümlenir.
*Kanıt:* Karan/Rosenthal/Robbins 2019 (30 çalışma, ~5.300 kişi);
Seraj/Blackburn/Pennebaker 2021 PNAS (6.803 kullanıcı, 1.027.541 gönderi).
*Sınır:* PNAS bulgusu kişisel gönderilerde, çift içi yazışmada değil.

**7. Dönüş oranı (turn-toward).** Her çağrı için karşı taraf aynı oturumda
doyurucu mu, minimal mi, olumsuz mu dönüyor.
*Kanıt:* Gottman'ın yapı taşı. **Yalnızca yapı alınır, rakamlar alınmaz.**
*Sınır:* "Ustalar %86, felaketler %33" küçük ve post-hoc bir çalışmadan; oran
olarak kullanılmaz, sadece taraflar arası fark bildirilir.

**8. Takip–geri çekilme.**
*Kanıt:* Schrodt/Witt/Shimkowski 2014 meta-analizi (74 çalışma, N=14.255):
r=.360, sıkıntılı örneklemde .413. Tek bir iletişim deseni olarak
memnuniyetsizlikle en güçlü bağı olan bulgu.
*Sınır:* Metin, geri çekilenin içsel bunalmasını göstermez.

**9. Gecikme asimetrisi ve seyri.**
*Kanıt:* Walther & Tidwell 1995; Teichmann 2026 JSPR — mesaj zamanlaması **U
biçimli**, tek yönlü değil.
*Sınır:* Gecikme müsaitlik de demektir. Tek gecikme hiçbir şey, sürekli
asimetri desen.

### Katman 3 — betimleyici, motiv adı verilmez (S7)

**10. "biz neyiz" sorulmuş mu, cevaplanmış mı.** Kullanıcının asıl sorusu bu.
*Kanıt:* İlişkisel Türbülans Kuramı (Knobloch & Solomon); situationship üzerine
nitel çalışma (MDPI 2026). Belirsizliğin kendisi stres kaynağı.
*Sınır:* Konunun açılmamış olması bir şey demek değil, sadece "açılmamış" demek.

**11. Kesintili temas.** Uzun sessizlikler + kısa geri dönüşler.
*Sınır:* Motiv adı verilmez (bkz. YASAKLAR).

**12. Hitap kayması (sen/siz, isim, lakap).** Türkçeye özgü, batı literatüründe yok.
*Sınır:* Kalibre edilmemiş; önce betimleyici kullanılır.

**13. Değer verme ifadesi asimetrisi.**
*Kanıt:* Joel 2020 PNAS takdiri en güçlü yordayıcılar arasında buldu.
*Sınır:* Kültürel norm farkı büyük.

### Ölçülüp gösterilmeyecek

**Dil stili uyumu (LSM)** — hesaplanabilir ama uyum göstergesi olarak sunulmaz
(bkz. YASAKLAR).

---

## VİRAL MEKANİK DERSLERİ

S10, S11 ve S14 bunları okur.

- **Kimlik yüklü tek çıktı.** Wrapped'ın "top artist"i, insanların paylaştığı şey.
  Burada karşılığı: kullanıcının kendisi hakkında bir şey söyleyen desen cümlesi
- **Merak boşluğu + linksiz artefakt.** Wordle: sonucu göster, cevabı verme
- **9:16, ekran görüntüsü için tasarlanmış.** Wrapped'ın tüm görselleri Story boyutunda
- **Ses ürünün kendisidir.** The Pudding kutlamak yerine hakaret ederek viral
  oldu; theyseeyourphotos rahatsız edici sakinlikle
- **Ücretsizlik yakıttır.** Strava yıllık özetini paywall'a koyunca "duyguyu
  paralı yapmak" diye eleştirildi. Kilitlenen kullanıcı partiye alınmamış gibi hisseder
- **Aktivasyon maliyeti sıfıra yakın olmalı.** Wordle: uygulama yok, kayıt yok, reklam yok
- **Provokasyon ürünsüz çöker.** Cluely rage-bait'le viral oldu ve 15 milyon
  dolar topladı, ama CEO'su gelir rakamı hakkında yalan söylediğini alenen kabul
  etmek zorunda kaldı. Bu ürünün üstünlüğü tam tersi: ölçüm dürüstlüğü

**Belirsizlik gösterilecekse** (tarih deseni çıktığında): sayısal aralık güveni
düşürmez, sözel belirsizlik düşürür (van der Bles / van der Linden, PNAS 2020,
n=5.780). Kural: tahminse min-max parantez içinde — "3 nisan (25 mart – 12
nisan)". Tek bir değer kesinlik ima eder (NYT iğnesi tartışmasının dersi).

---

## KOŞU KAYDI

Fazlar bittikçe buraya yazılır.

```
## S1 — Depo temiz + sızıntı — <durum>
ölçülen:   eşik:   commit:
hakem notu:
```
