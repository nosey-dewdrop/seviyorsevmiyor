// ortak fiş: her mockup aynı içeriği basar, sadece dünyası değişir.
// kullanım: <div class="receipt" data-fis></div> + bu script.
// data-ciddi olan fişte kasadan not ciddi kayda geçer (kırmızı-bayrak ekran kuralı).
(function () {
  var BARCODE =
    '<svg class="barcode" width="180" height="34" aria-hidden="true"><g fill="currentColor">' +
    [[0,3],[6,1],[10,2],[16,4],[23,1],[27,2],[33,1],[37,3],[44,1],[48,2],[54,4],[61,1],[66,2],[71,1],[75,3],[82,2],[87,1],[91,4],[98,1],[103,2],[108,3],[115,1],[119,2],[125,1],[129,4],[136,1],[141,2],[146,3],[153,1],[157,2],[163,1],[167,3],[174,2]]
      .map(function (b) { return '<rect x="' + b[0] + '" width="' + b[1] + '" height="28"/>'; }).join('') +
    '</g><text x="90" y="34" text-anchor="middle" font-size="7" fill="currentColor" font-family="inherit">2 6 8 0 7 2 2 1 4 0 7</text></svg>';

  function fis(ciddi) {
    var not = ciddi
      ? 'KAYDA GEÇSİN: bu sohbette emek tek yönde akıyor. bunu senin yorumun değil, satırların söylüyor.'
      : 'KASADAN NOT: sen sergi planı yapıyosun, o "bakarız" kasasında bozuk para sayıyor. bileti tek kişilik al.';
    return '' +
      '<div class="r-head">MESAJI BİR OKUSANA</div>' +
      '<div class="r-meta">FİŞ NO: 0268 · 14.07.2026 23:41</div>' +
      '<hr class="dash">' +
      '<div class="row"><span>SORU SORDUN, TEK KELİME DÖNDÜ</span><span>x3</span></div>' +
      '<div class="row"><span>PLAN ATTIN, "BAKARIZ" YEDİN</span><span>x2</span></div>' +
      '<div class="row"><span>ANI HATIRLATTIN, "HI" ALDIN</span><span>x1</span></div>' +
      '<div class="row"><span>ÖZLEDİM DEDİN, "OK" GELDİ</span><span>x1</span></div>' +
      '<div class="row"><span>SORU İŞARETİ SENDE, ONDA YOK</span><span>x4</span></div>' +
      '<hr class="dash">' +
      '<div class="row"><span>ARA TOPLAM</span><span>SEN %78 · O %12</span></div>' +
      '<div class="row"><span>KDV</span><span>%0 (BEDAVA)</span></div>' +
      '<div class="row total"><span>TOPLAM</span><span>FLÖRT VAR, AMA TEK TARAFLI.</span></div>' +
      '<hr class="dash">' +
      '<p class="not">' + not + '</p>' +
      '<hr class="dash">' +
      '<div class="row"><span>MÜŞTERİ</span><span>SEN</span></div>' +
      '<div class="row"><span>KART</span><span>**** **** **** 2026</span></div>' +
      BARCODE +
      '<p class="center">MESAJIN İÇİN TEŞEKKÜRLER<br>HÜKÜM CİHAZDA VERİLDİ · MESAJLAR KİMSEYE GİTMEZ</p>';
  }

  document.querySelectorAll('[data-fis]').forEach(function (el) {
    el.innerHTML = fis(el.hasAttribute('data-ciddi'));
  });
})();
