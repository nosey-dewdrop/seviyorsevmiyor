# seviyorsevmiyor

## What it is
A "read the subtext" site for chats. Paste / screenshot / drop a WhatsApp export → the engine commits
a call ("flört var mı, yok mu?") with evidence, theyseeyourphotos energy, Turkish-first, free/unlimited.
Not a wrapper: own on-device statistical cascade; Llama (Groq worker) only voices the reveal with consent;
engine numbers are LAW. Renamed 15 Tem from mesajibirokusana (terazi mekaniği + Damla "repo adı bu olsun").

## Status (v70, CANLI: nosey-dewdrop.github.io/seviyorsevmiyor)
Ürün canlıda çalışıyor: iki-sütun giriş, analiz, SADE kart (skor barı+istatistik+grafik), theyseeyourphotos
tonlu yorum. Motor parse+balance Node-kanıtlı. Worker `seviyorsevmiyor-api` deploy'lu, GROQ_API_KEY taze.

Açık işler (Damla'da / karar onun):
- Spiker kanıt-uydurma fix commit'li ama HENÜZ DEPLOY EDİLMEDİ → `cd backend && npx wrangler deploy`.
- FLÖRT TAVSİYESİ metni: brand'e tıkla → boş placeholder, Damla kendi sesiyle yazacak (index.html .dev-notu).
- og.png stale (hâlâ terazi+kalp): PNG üretici yok + headless yasak → Damla og.svg'yi 1200x630 export etmeli.
- LLAMA MİMARİ ÇELİŞKİSİ: ham `doc` metni hâlâ Llama'ya gidiyor (gizlilik.html dürüstçe böyle diyor). Damla
  "sadece istatistik gitsin" istemişti; doc'u çıkar (kanıt/alıntı düşer) vs kalsın kararı ONA ait.
- DOMAIN: share.js + og:url uzun github.io adresi yazıyor; kısa domain bağlanırsa ikisi güncellenmeli.

## Kritik kurallar
- LOCALHOST YOK: her değişiklik gh-pages'e push edilip canlıda görülür (Damla emri, 15 Tem).
- Deploy: `git subtree split --prefix web -b t && git push -f origin t:gh-pages && git branch -D t`.
- HER bump'ta TÜM js v'sini zorla: `for f in web/js/*.js; do sed -i '' -E 's/\?v=[0-9]+/?v=YENİ/g' "$f"; done`
  + footer bump. Yoksa eski kod cache'te donar (v61 bug'ı). Dinamik import (share.js) dahil.
- Engine numbers are LAW; template lines are the fire escape (no consent / worker down). Copy law: küçük harf,
  EM DASH yok, sorular "?" ile biter, "kanka" yasak (mesafeli gözlemci), krem/renkli-tek-kelime/pill yasak.

## Retrain / verify
`python3 train/train.py`; verify `python3 train/parity_check.py && node train/parity_check.mjs`.
Seed 268, held-out 72.2% (hard set). Ship model.json only if it improves; synth train-only, real held-out.

Detay/tarihçe/arşiv + viral hamleler + roadmap → PROJECT.md.
