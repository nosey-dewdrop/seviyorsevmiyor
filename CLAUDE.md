# seviyorsevmiyor

## What it is
A "read the subtext" site for chats. Paste / screenshot / drop a WhatsApp export → the engine commits
a call ("flört var mı, yok mu?") with evidence, theyseeyourphotos energy, Turkish-first, free/unlimited.
Not a wrapper: own on-device statistical cascade; Llama (Groq worker) only voices the reveal with consent;
engine numbers are LAW. Renamed 15 Tem from mesajibirokusana (terazi mekaniği + Damla "repo adı bu olsun").

## Status (v72, CANLI: nosey-dewdrop.github.io/seviyorsevmiyor)
İKİ AKIŞ var. Eski: `index.html`, kısa sohbet yapıştır → flört hükmü. Yeni: `zaman.html`, WhatsApp
export bırak → "bu sohbet ne zaman değişti" + tarih + güven aralığı. Yeni akış 16 Ağu'da kuruldu.

ZAMAN MOTORU (`web/js/time/`, 6 Node kapısı yeşil, `node train/*_check.mjs`):
parse damgayı artık atmıyor (naive dakika, Date.UTC), tur/oturum bölütleme, veriden kestirilen tau,
uyku düzeltmesi, rank-CUSUM değişim noktası + blok permütasyon + residual bootstrap tarih CI.
Ölçüm: null seride yanlış pozitif %0, sürüklenmede %0 (trend kapısı 0.95, taramayla seçildi),
gerçek 4x sıçramada güç %75, tarih CI kapsama %89.3 (nominal %90). 39.5k mesaj 686 ms.
E2E: ekilen kırılma 2 Nisan, bulunan 3 Nisan.

⚠ TARAYICIDA HİÇ ÇALIŞMADI. Worker, dosya bırakma, zip açma, bulut butonu sadece Node'da doğrulandı.
Damla bir export bırakana kadar "çalışıyor" DENMEZ. Açık blokör budur.

Açık işler:
- PAYLAŞIM KARTI yok: share.js zaman akışına bağlı değil, viral yüzey eksik.
- og.png stale (hâlâ terazi+kalp): headless yasak → Damla og.svg'yi 1200x630 export etmeli.
- LLAMA MİMARİ ÇELİŞKİSİ **eski akışta duruyor**: index.html hâlâ ham `doc` yolluyor. Yeni akışta
  çözüldü (sadece 326 baytlık sayı gider, isim/mesaj yok, `train/bulut_check.mjs` kanıtlıyor).
- ocr.js hâlâ CDN'den Tesseract çekiyor (jszip yerele alındı, bu alınmadı).
- DOMAIN: share.js + og:url uzun github.io adresi yazıyor.

16 Ağu NOTU: worker KAZARA deploy edildi (commit mesajındaki backtick zsh'de çalıştı, Version ID
0bced59e). Yan etkisi: bekleyen spiker kanıt-uydurma fix'i de canlıya çıktı. Kırılan yok, secret
yerinde. Geri dönülecekse `npx wrangler rollback`.

## Kritik kurallar
- LOCALHOST YOK: her değişiklik gh-pages'e push edilip canlıda görülür (Damla emri, 15 Tem).
- Deploy: `git subtree split --prefix web -b t && git push -f origin t:gh-pages && git branch -D t`.
- HER bump'ta TÜM js v'sini zorla: `for f in web/js/*.js; do sed -i '' -E 's/\?v=[0-9]+/?v=YENİ/g' "$f"; done`
  + footer bump. Yoksa eski kod cache'te donar (v61 bug'ı). Dinamik import (share.js) dahil.
- Engine numbers are LAW; template lines are the fire escape (no consent / worker down). Copy law: küçük harf,
  EM DASH yok, sorular "?" ile biter, "kanka" yasak (mesafeli gözlemci), krem/renkli-tek-kelime/pill yasak.

## Retrain / verify
Zaman motoru: `for t in parse timeline cpd e2e yazi bulut; do node train/${t}_check.mjs; done`.
Ton modeli: `python3 train/train.py`; verify `python3 train/parity_check.py && node train/parity_check.mjs`.
Seed 268, held-out 72.2% (hard set). Ship model.json only if it improves; synth train-only, real held-out.

Repoyu ilk açan → README.md. Tarihçe → devlog.md. PROJECT.md 30 Ağu'da kaldırıldı: adı hâlâ
"whatdoyoumean"dı ve Gemini şelalesini anlatıyordu; tek doğru kaynak bu dosya + KOSU-v1.md.
