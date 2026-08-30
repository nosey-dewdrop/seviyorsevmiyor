# S0 · TARAYICI MASASI — rapor

Doldurulacak. Boş bırakılan test S4'ü bloke eder.
Ekran görüntüleri bu klasöre `ss-t1.png`, `ss-t2.png` ... diye konur.

**Adres:** https://nosey-dewdrop.github.io/seviyorsevmiyor/
**Zaman akışı:** https://nosey-dewdrop.github.io/seviyorsevmiyor/zaman.html
(elle yazılacak, hiçbir yerden link yok)

**Canlı sürüm:** v73 · 30 Ağu — altbilgide bunu gör, göremiyorsan sayfayı
hard refresh et (Cmd+Shift+R). v72 görüyorsan eski cache'tesin, ölçüm geçersiz.

---

## T1 · masaüstü, küçük export (birkaç yüz mesaj)

sayfa açıldı mı ................ [ ]
dosya kabul edildi mi .......... [ ]
zip açıldı mı .................. [ ]
ekranda SONUÇ var mı ........... [ ]   (spinner'da kalmadı mı)
konsolda hata .................. birebir yapıştır:
```

```
ekran görüntüsü ................ ss-t1.png

---

## T2 · masaüstü, büyük export (20 MB+, en uzun sohbet)

kaç MB ......................... 
kaç mesaj ...................... 
kaç saniye ..................... 
sekme dondu mu ................. [ ]
bellek tepe değeri ............. MB   (geliştirici araçları → Memory)

Kıyas: Node'da 39.5k mesaj 686 ms. Tarayıcıda 5-10 katı NORMAL.
100 katı = parse ana thread'i kilitliyor demektir, S4'e madde eklenir.

ekran görüntüsü ................ ss-t2.png

---

## T3 · telefon, normal tarayıcı (Safari/Chrome)

sayfa açıldı mı ................ [ ]
dosya seçici export'a erişti mi  [ ]
büyük dosyada sekme çöktü mü ... [ ]
   (Safari çökerse sayfa kendiliğinden yenilenir = bellek yetersizliği)
süre ........................... saniye

ekran görüntüsü ................ ss-t3.png

---

## T4 · Instagram in-app tarayıcı ← EN KRİTİK

Kendine linki DM at, Instagram İÇİNDEN aç. Safari'den AÇMA.

sayfa açıldı mı ................ [ ]
DOSYA SEÇİCİ ÇALIŞTI MI ........ [ ]   ← bu fazın asıl sorusu
export seçilebildi mi .......... [ ]
sonuç geldi mi ................. [ ]

ekran görüntüsü ................ ss-t4.png

**Bu test başarısızsa** export yolu kapanır, ekran görüntüsü ana yol olur,
ve OCR bir satır iş değil KENDİ FAZI olur (S4b).

---

## T5 · bulut yolu — BU TURDA ATLA

Canlıda `TURNSTILE_SITEKEY` boş, bulut yolu kapalı. Test edilecek bir şey yok.
Butona basarsan artık boş kutu yerine sebebi yazıyor, onu görürsen doğru
çalışıyor demektir.

atlandı ........................ [x]

---

## T6 · yapıştırma yolu

kısa sohbet yapıştırınca çalıştı mı .......... [ ]
telefonda uzun sohbeti kopyalamak pratik mi .. [ ]   (muhtemelen değil)

---

## SERBEST NOT

Beklemediğin, garip gelen, "bu böyle mi olmalı" dediğin her şey buraya.
Kısa cümleler yeter.

```

```
