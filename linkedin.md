# whatdoyoumean — damla essayleri (linkedin)

format: 300-500 kelimelik blog yazıları. her yazı kendi içinde numaralı zinciri taşır:
amaç neydi, hangi his uyandırdı, o yüzden ne ekledim (neden), hangi pivotu yaptım (altındaki karar),
gerçek ürüne giden yolda ne yaptım. hepsi gerçek tarihçeden, uydurma adım yok. sınır yok.

---

## essay 1 — wrapper yazmayı reddettiğim gün

Bir siteye fotoğraflarımı verdim, bana kim olduğumu söyledi. theyseeyourphotos: fotoğrafını atıyorsun, bir yapay zekanın gözünden hakkında ne çıkarılabileceğini yüzüne okuyor. Ürkütücü ve bağımlılık yapıcı. Ben o hissi başka bir yerde aradım: hepimizin telefonunda duran, ekran görüntüsünü arkadaşlarımıza atıp "sence ne demek istedi" diye sorduğumuz sohbetlerde. Projenin adı da sorunun kendisi oldu: whatdoyoumean.

1. Amaç buydu: bir sohbeti yapıştır, altındaki alt-metni oku. Flört mü, arkadaşça mı, kim daha çok istiyor, yeşil bayrak mı kırmızı mı. İlk taslağı kafamda kurduğumda kolay yol belliydi: sohbeti al, hazır bir dil modeline yolla, cevabı şık bir kutuda göster. Ve tam o anda proje bana slopware hissi verdi. Çünkü öyleydi: bir API anahtarına giydirilmiş arayüz. Bunun neresi benim ürünüm?

2. Üstüne iki dert daha bindi. İnsanların en mahrem verisi olan mesajları benim sunucumdan geçecekti ve her okuma bana para yazacaktı. Üç sorunun kökü aynıydı: motorun benim olmaması. O gün kararı verdim: bu ürün wrapper olmayacak.

3. Peki kendi modelini eğitmek isteyen öğrencinin GPU parası nereden gelecek? Burada ikinci karar geldi: ton sınıflandırma dediğin şey aslında sayılabilir sinyallerin işi. Soru oranı, emoji yoğunluğu, hitaplar, mesaj uzunluk asimetrisi, kelime örüntüleri. Bunun için transformer değil, TF-IDF artı lojistik regresyon yeter ve laptop işlemcisinde saniyeler içinde eğitilir. Derin ağ prestijli, istatistik dürüst. Küçük veriyle derin ağ ezberler; istatistik ne bildiğini ve bilmediğini söyler. Türkçe sohbetleri elle etiketleyip ilk modeli kendi bilgisayarımda eğittim.

4. Nüansı, sarkazmı, karışık sinyalleri istatistiğin çözemeyeceğini de baştan kabul ettim. Çözüm kademeli mimari: model her cevapta bir güven payı üretiyor. Eminse cevap cihazda bitiyor. Emin değilse kullanıcıya soruyorum: istersen buluta sorayım, senin onayınla. Asıl numara üçüncü adımda: o zor vakaların cevapları yeni etiketli veri oluyor, modelim onlarla yeniden eğitiliyor ve bulut ihtiyacı her turda küçülüyor. Hazır model burada beyin değil, geçici bir öğretmen. Hedef, onu tamamen işten çıkarmak.

Gerçek ürüne giden yol benim için burada başladı: en kolay mimariyi reddedip, kendi motorunu yazmayı göze almakla. Sonraki yazıda bu kararın beklenmedik hediyesini anlatacağım: mesajların telefondan hiç çıkmaması ve KVKK'nın en ağır sorusunun kendiliğinden çözülmesi.

---

## essay 2 — veriyi korumanın en iyi yolu: hiç almamak

İnsanların özel mesajlarını okuyan bir ürün yazıyorsun. İlk soru teknik değil hukuki: bu veriyi nasıl koruyacaksın? Benim cevabım projenin en sevdiğim kararı oldu: almıyorum ki.

1. Motoru kendim yazınca model dediğim şey küçük bir katsayı listesine dönüştü. Bunu JSON olarak dışa aktarıp tarayıcıya yükledim; analiz kullanıcının cihazında oluyor, sohbet hiçbir sunucuya gitmiyor. KVKK'nın en ağır sorusu mimari bir kararla kökten çözüldü. "Verini şifreliyorum" demek zorunda değilim, "verin bende değil" diyorum.

2. Ama bir sohbetin iki sahibi var ve karşı taraf onu bir analiz aracına yüklemeye onay vermedi. Bu yüzden görünür bir dürüstlük katmanı ekledim: "bu sohbeti paylaşma hakkım var" kutusu işaretlenmeden okuma yok. Gizlilik sayfası da ilk sürümle aynı gün çıktı. Kural koydum kendime: veri toplayan özellik hangi sürümde çıkıyorsa, rıza metni aynı sürümde çıkar. Sonradan yamanmaz.

3. Ürünün en can alıcı çıktısını da bilerek modele vermedim. "Kim daha çok istiyor" sorusuna yapay zeka cevap vermiyor; sayaç cevap veriyor. Kim daha uzun yazıyor, kim üst üste mesaj atıyor, kim daha çok soru soruyor, kim hitap kullanıyor. Hepsi deterministik kural: aynı sohbete her seferinde aynı cevap ve her iddianın gösterilebilir kanıtı var. Yapay zekanın uydurma lüksü var, sayacın yok.

4. Bu mimarinin görünmeyen bir bedeli vardı: modeli Python'da eğitiyorum ama tarayıcıda JavaScript çalıştırıyorum. Özellik çıkarıcıyı iki dilde birebir aynı yazmak zorundaydım, yoksa model eğitildiği dünyadan başka bir dünyada karar verir ve bunu kimse fark etmez. Bunun için parity testi kurdum: aynı sohbetler iki dilde işleniyor, çıkan sayılar karşılaştırılıyor, kabul ettiğim fark makine hassasiyeti. Sıkıcı iş, kimse demosunu izlemez. Ama gerçek ürünle demo arasındaki çizgi tam burası: görünmeyen yerde de doğru olmak.

5. Güvenin son parçası da şeffaflık oldu. Her analizin altında "nasıl okudum?" bölümü var: kaç mesaj sayıldı, kaçı senden kaçı ondan, model neye ne kadar güvendi, sayımlar modelin hükmünü değiştirdi mi. Kara kutuya kimse güvenmez; hesap verebilen ürüne güvenilir.

Bir dahaki yazı zor kısım: çalışan kodu söküp atmak. İki kere.

---

## essay 3 — çalışan kodu söktüm, iki kere

Yazılımda en zor commit, çalışan bir özelliği silen commit. whatdoyoumean'de bunu iki kere yaptım ve ikisi de ürünü büyüttü.

1. Başta hesap sistemi vardı. E-postayla giriş, kullanıcı profili, premium alanı; şirketin ortak backend'ine bağlı, temiz çalışıyordu. Sonra referans ürünüme dönüp baktım: theyseeyourphotos'ta hesap yok. Giriyorsun, deniyorsun, ürpertiyle çıkıyorsun. Sürtünme sıfır. Benim ürünüm de tek atımlık bir fikir aracı; kimse mesajlarını analiz ettirmek için üyelik açmak istemez. Üstelik hesap yoksa sunucuda kullanıcı verisi de yok, gizlilik hikayem daha da temizlendi. Giriş sistemini kökünden söktüm.

2. İkinci söküm daha çok acıttı çünkü kendi prensibimle çelişiyordu. Her ürünüme gelir modeliyle doğma kuralı koymuştum; buna da günlük beş okuma sınırı ve bir premium ekranı koydum. Sonra stratejiye dönüp baktım: bu ürün fikir kanıtı ve kitle aracı. İnsanların sonucu ekran görüntüsü alıp paylaşası gelsin diye var. Viral olması istenen bir şeye beşinci kullanımda turnike koymak kendi ayağına sıkmak. Sınırı ve premium ekranını tamamen kaldırdım: ücretsiz, sınırsız, hesapsız.

3. İki sökümün altında aynı karar yatıyor: her özellik ürünün amacına hizmet etmiyorsa ürünün üstünde yüktür, çalışıyor olması onu haklı çıkarmaz. Para modeli de ürünün amacına uyar, tersine değil. Bu ürünün getirisi kullanıcı ve hikaye; kasa başka üründe durur.

4. Bu kararların pratik bir dersi de var. Sökmek eklemekten daha çok disiplin istiyor çünkü kayıp hissi veriyor: o kodu yazmak için harcanan akşamlar gözünün önüne geliyor. Benim işime yarayan soru şu oldu: bu özelliği bugün sıfırdan kurma kararı verir miydim? Cevap hayırsa, özellik zaten ölmüş, sadece repo'da yaşıyor.

5. Ve gerçek ürüne giden yolda bu iki söküm, eklediğim çoğu özellikten daha çok iş yaptı. Açılış sayfası tek cümleyle anlatılır hale geldi: sohbeti yapıştır, alt-metni oku, mesajların telefonundan çıkmaz. Ne üyelik ne ücret ne yıldızlı paket tablosu. Ürünün kimliği, ondan çıkarılanlarla netleşti.

Sıradaki yazı bu serinin en utanç verici ve en öğretici günü: ürünümü müşteri gibi test ettim ve modelim bir kavgaya yüzde 63 flört dedi.

---

## essay 4 — modelim kavgaya yüzde 63 flört dedi

Yapay zeka ürünlerinin en tehlikeli anı, emin bir sesle yanlış konuşması. Benimki bunu yaptı ve ben fark etmedim; çünkü hep kendi hazırladığım örneklerle test ediyordum. Bir gece oturup ürünü bir müşteri gibi gezdim: altı gerçek hayat senaryosu, baştan sona.

1. Sonuç yüz kızartıcıydı. Sorgu suali bir kavga ("dün gece neredeydin, kiminle, isim ver") modelime göre yüzde 63 flörttü; soru işaretlerini ilgi sanıyordu. Tek taraflı ölü bir sohbet ("özledim seni" diyen bir taraf, "hı" ve "bakarız" diyen diğer taraf) yüzde 99 flörttü; sıcak kelimeleri görüyor, kimin yazdığına bakmıyordu. En kötüsü: aynı ekranda dört kırmızı bayrak basıp kapanışta "birileri diğerini merak ediyor" diye romantik cümle kuruyordu. Ürünüm kendi içinde çelişiyordu.

2. İlk refleks "daha büyük model lazım" demek. Direndim, çünkü sorun modelin boyu değil güç dengesiydi. Çözüm: model artık sadece öneriyor, sayılabilir sinyallerin veto hakkı var. İki ayrı kırmızı bayrak türü sayıldıysa flört hükmü düşüyor, gerginlik kazanıyor ve ekran nedenini söylüyor. Yakınlık dili tek taraftan akıyorsa hüküm "tek taraflı" oluyor ve flört sinyali tek sayı yerine iki taraflı basılıyor: sende yüzde 40, onda yüzde 0. Bazen ürünün bütün cevabı o tek satır.

3. Modelin payına düşeni de yaptım ama hedefli: rastgele veri yığmak yerine, tam o üç karışıklığı anlatan örnekler etiketledim. Sorgu tarzı kavgalar, tek tarafı sıcak ölü sohbetler, kısa nötr selamlaşmalar. Veri 169 örnekten 211'e çıktı, doğruluk yüzde 79'dan 83.7'ye. Küçük sayılar; ama yönü doğru ve ölçümü dürüst.

4. Açıklamaları da aynı geceden çıkan şikayet düzeltti: "ne yaptığını anlamadım." Artık denge iddiası kanıtını yanında taşıyor (mesaj dokuza beş, soru üçe sıfır), mesaj okumaları sohbetin tamamını tarıyor ve sorgu cümlesini "ne güzel soru sormuş" diye övmüyor. Bekleme süresini yüzde altmış kestim; ekrana dokununca her şey anında iniyor.

5. Dürüst durum tespiti: 211 örnekli bir motor henüz küçük lig. Yol belli: etiketli veriyi bine çıkarmak, bulut destekli öğrenme döngüsünü canlıya almak, veri büyüyünce Türkçe BERT koluna geçmek. Ve en zoru: gerçek kullanıcı.

Bu serinin kendisi de o kararlardan biri: süreci saklamak yerine göstermek. Çünkü bir ürünün slopware olmadığının en iyi kanıtı, altındaki kararların hesabını verebilmesi.

## essay 5 — beyni kiralamadım, ağzı kiraladım

bu hafta mesaj analiz ürünüme büyük dil modeli bağladım. ilginç olan ne bağladığım değil, neyi bağlamadığım.

ürünün işi tek cümle: bir sohbet yapıştırıyorsun, "flört var mı, yok mu?" sorusuna net cevap alıyorsun. bu cevabı baştan beri cihazda çalışan kendi küçük istatistik modelim veriyor: kim daha çok yazmış, kim soru sormuş, hangi red flag kalıpları geçmiş; hepsi sayılıyor, hiçbiri uydurulmuyor. sorun cevapta değil, cümlelerdeydi. kırk tane elle yazılmış şablonum vardı ve herkes aynı yazıyı görüyordu. ilk gerçek kullanıcı yorumu acımasızdı: "generik, ai gibi."

ilk refleks tahmin edilebilir: her şeyi gpt'ye devret. bunu yapmadım, çünkü o zaman ürünüm bir sargı kağıdı olurdu; hüküm de, hata da, kimlik de kiralık olurdu. onun yerine işi ikiye böldüm. hükmü, yüzdeleri ve sayımları cihazdaki motor veriyor; bunlar değişmez, kanun. llama ise o raporu alıp arkadaşının atacağı mesaja çeviriyor ve sohbette gözden kaçanları söylüyor: "hep kendini anlatmış, sana bir kez bile sen nasılsın dememiş." kural şu: her gözlem sohbetten gerçek bir alıntıyla kanıtlanmak zorunda. alıntı bulamıyorsa o gözlemi yazamıyor.

bu mimarinin üç getirisi oldu. bir: tutarlılık. aynı sohbete hep aynı karar çıkıyor çünkü karar deterministik; sadece anlatım tazeleniyor. iki: dayanıklılık. bulut çökerse, kota biterse, kullanıcı onay vermezse şablonlar devrede; ürün internetsiz de cevap veriyor. üç: dürüstlük. yapay zekanın en tehlikeli huyu olan "güzel yazılmış uydurma", sayıları değiştiremediği bir kafese kapatıldı.

isim de bu hafta değişti: whatdoyoumean gitti, mesajibirokusana geldi. türkçe bir ürünün ingilizce ismi ağızdan ağıza yayılamıyor; yeni isim zaten ürünü kullanırken kurduğun cümle. bir de hüküm dili netleşti: "kıvılcım var ama dosya kapanmadı" tarzı orta yol cümlelerini sildim. varsa var, yoksa yok. dürüstlük kanıt satırında yaşamaya devam ediyor, ama başlık artık taraf tutuyor.

ders: yapay zekayı ürünün beyni yapmak kolay ve tembel bir karar. onu spiker yapmak, beyni kendinde tutmak daha çok iş; ama ürünü senin yapan da o iş.


---

## 6 — sınavı kendi sorularınla yapamazsın

bu hafta ürünün motorunu büyütmem gerekiyordu ve elimde 268 örnek vardı. seviyorsevmiyor bir sohbeti okuyup "flört var mı" diye hüküm veriyor; hükmü veren şey tarayıcıda çalışan, benim eğittiğim küçük bir istatistik modeli. 268 örnek bir model için açlık sınırı: zor sette isabet %72.2 idi.

klasik yol belli: aylarca kullanıcı bekle, veri birifsin. benim aylarım yok, 2 ağustos'ta lansman var. o yüzden öğretmen damıtması yaptım: claude'a 420 etiketli türkçe sohbet ürettirdim. kolay örnek istemedim; typo'lu, yarım cümleli, "sjsjs"li, gri vakalı istedim. flört gibi görünen arkadaşlık, kibarlığa sarılmış soğukluk, sakin cümleye gizlenmiş gerginlik. gerçek insanların dağınıklığını taklit etmeyen sentetik veri, cilalı bir yalan çünkü.

asıl karar veri üretmek değildi. asıl karar şuydu: sentetik örnekler sadece eğitime girer, ölçüm setine asla. modelini kendi ürettiğin sorularla sınava sokarsan notun yükselir ama bilgin yükselmez; kağıt üstünde parlak, gerçekte kör bir model olur. ölçümü yine 54 gerçek örnekte yaptım. sonuç: %72.2'den %75.9'a. üç puan mütevazı duruyor; 54 soruluk sınavda iki soru daha demek ve daha önemlisi, yalansız bir sayı.

bu düzenin güzel tarafı çark olması. kullanıcı hükme itiraz ettiğinde satırlarını rızasıyla bağışlayabiliyor; her bağış gerçek, etiketli veri. gerçek veri biriktikçe sentetiğin payı düşecek, model her turda biraz daha benim olacak. bugün büyük modeller öğretmen, benim motorum öğrenci; hedef, öğrencinin sınıfı geçip kürsüye oturması.

ders: yapay zekayla veri üretmek artık kolay. zorlaşan şey dürüst kalmak. sayıyı yükseltmenin yüz yolu var, yükseldiğine kendini inandırmanın tek yolu var: sınav kağıdına elini sürmemek.

---

## 7 — kendi onayladığın rengi silebilmek

gece boyu seviyorsevmiyor'un arayüzünü tasarladık. mockup'ta bir şeftali-mercan vurgu rengi vardı, onu ben seçmiştim, ben onaylamıştım. ama ertesi gün canlıda görünce içim rahat etmedi. tek kelimeyle tarif ettim: slopware. bugün her yapay zeka sitesinin üstünde o aynı pastel vurgu var, o aynı yuvarlak kart, o aynı "üretildim" kokusu. kendi ürünüm de o kalabalığa karışmıştı.

sildim. sadece rengi değil, arkasındaki refleksi. yeşil denedim, mavi denedim; onlar da başka bir şablonun parçasıydı. sonunda renk aramayı bıraktım. dedim ki bu bir terminal olsun: antrasit, beyaz, başka hiçbir şey. vurguyu renk değil, kalınlık ve boşluk versin. sonra giriş ekranındaki kutuları da sildim, yerlerine kodun içindeki gibi eğik çizgiler koydum. bir arayüzü daha az çizerek daha çok kendime ait yaptım.

burada asıl zorlanılan şey estetik değildi, sahiplenmeydi. kendi verdiğin bir kararı geri almak, başkasının kararını eleştirmekten daha zor; çünkü onu savunmak egonu savunmak gibi hissettiriyor. oysa onayladığın bir şey bile canlıda yanlış hissettiriyorsa, seni bağlayan şey o onay değil, o his olmalı. mockup yalan söyleyebilir; kullanıcının gözüne çarpan gerçek ekran söyleyemez.

bir de şunu öğrendim: bu ürün bir mühendislik gösterisi değil, bir duygu. birine "sana flört ediyor mu" sorusunu soğuk bir dashboard'la cevaplayamazsın. o yüzden sonuca bir kalp puanı koydum, çünkü instagram story'sine bir sayı değil bir his gidiyor. paylaşılabilirlik sonradan eklenen bir özellik değil, en baştan bir tasarım kararı.

ders: bir şeyi silmek çoğu zaman eklemekten daha çok tasarımdır. ve kendi onayını geri alabilmek, bir ürünü senin yapan şeyin ta kendisi.

---

## 8 — ismi üç kere değiştirmek zayıflık değil, dinlemektir

bu ürünün adı üç oldu. whatdoyoumean ile başladı, mesajibirokusana oldu, sonunda seviyorsevmiyor'da durdu. dışarıdan bakınca bu kararsızlık gibi görünür; içeriden bakınca her isim bir öğrenmenin kalıntısı.

ilk isim mühendisin ismiydi. whatdoyoumean kulağa akıllı geliyordu, "ne demek istedin" sorusunu ingilizce soruyordu. ama ürün türkçe, kullanıcı türkçe, ve türkçe bir ürünün ingilizce ismi ağızdan ağıza yayılamıyor. birine "şu siteye bak" derken adını heceleyemiyorsan, o isim viral olmaz. bunu masabaşında değil, kendi ağzımın takılmasında anladım.

ikinci isim düzeltmeydi: mesajibirokusana. artık türkçeydi, üstelik ürünü kullanırken kurduğun cümleydi — "şu mesajı bir okusana". doğru yöndü ama uzundu, hantaldı, story'ye sığmıyordu. isim hâlâ benim tarif ettiğim şeydi, kullanıcının hissettiği şey değil.

üçüncü isim ürünün ta kendisiydi: seviyorsevmiyor. papatya falı. çocukken yaprak kopardığın o oyun. ürün zaten bir sohbete bakıp "seviyor mu sevmiyor mu" diye hüküm veriyordu; ismi de o oyun olmalıydı. bu isim bir açıklama değil, bir duygu. kimseye ne yaptığını anlatmıyor, herkesin zaten bildiği bir hissi çağırıyor.

buradaki asıl karar isimlerde değildi, kime kulak verdiğimdeydi. ilk isim benim zekamı gösteriyordu, sonuncusu kullanıcının duygusunu. bir ürünü adlandırırken kendini ne kadar akıllı gösterdiğin değil, karşıdakinin o ismi ne kadar kolay söylediği önemli. üç isim, üç kere egoyu bir kenara koymak demekti.

ders: ismi değiştirmekten korkma. her değişiklik bir itiraf: "önceki, benim içindi, seninkini bulamamıştım." ürünün adı senin cümlen değil, kullanıcının ağzından çıkan cümle olmalı.

---

## 9 — on mockup çizip hepsini çöpe atmak

bu ürünün görünüşünü bulmak için bir gecede on farklı dünya çizdim. fiş dünyası, terazi dünyası, mercan dünyası, terminal dünyası. sabah baktığımızda onunun da yaşamadığını gördük. ama o on ölü mockup boşa gitmedi; her biri bir yanlışı elenmiş halde bıraktı.

en uzun yaşayan fikir "fiş"ti. sohbeti bir market fişi gibi göstermek — kalem kalem, altta toplam. tatlıydı, ama sahteydi. fişte para satırları olur, benim ölçtüğüm şey para değil; fiş görünümü sadece bir kostümdü, ürünün kendi dili değildi. onu attık. sonra terazi geldi: sallanan bir kefe, "seviyor... sevmiyor..." diye durulan. güzeldi ama süstü. ölçtüğüm şey terazi değil, sayılardı; metafor gerçeği süslüyordu, taşımıyordu.

asıl karar şuydu: bir ürünün görseli, ölçtüğü şeyin dilini konuşmalı. fiş para sayar, terazi ağırlık tartar, ama ben mesaj okuyorum. o yüzden en sonunda bütün metaforları attık ve ürünü kendi diline bıraktık: bir yüzde, bir çubuk grafiği, düz sayılar, terminal sadeliği. süs değil, veri.

on mockup'ı çizmeseydim bu sadeliğe inanamazdım. çünkü sadelik, denenmemiş bir tembellik olabilir de, elenmiş bir olgunluk da. aradaki farkı ancak süslü olanı çizip "hayır, bu benim değil" diyerek anlarsın. boşa çizim yoktur; her reddedilen tasarım, doğru olana bir kanıt bırakır.

en acı ders şuydu: kendi onayladığın süsü silmek, hiç koymamaktan daha zordur. mercan rengini ben seçmiştim, kalp puanını ben koymuştum, terazi mekaniğini ben çizmiştim. üçünü de sildim. çünkü canlıda gördüğümde içim rahat etmedi, ve seni bağlayan şey dünkü onayın değil, bugünkü hissin olmalı.

ders: on kötü fikir, bir iyi karardan ucuzdur. asıl pahalı olan, ilk çizdiğine âşık olup denemekten vazgeçmek.

---

## 10 — kullanıcı "eşit" hissetmiyorsa motor yanlıştır

ürünün en değerli düzeltmesi bir sayı eklemek değil, bir yanlışı görmek oldu. bir sohbeti test ettim: bir taraf paragraf paragraf yazmış, kalbini dökmüş, sorular sormuş; diğeri "hı", "bakarız", "yoğunum" diye geçiştirmiş. motorum sonuca baktı ve "denge eşit" dedi. teknik olarak haklıydı — ikisi de üç mesaj atmıştı. ama insan olarak baktığımda bu apaçık yanlıştı.

sorun şuydu: motorum mesaj sayısını sayıyordu. üçe üç, demek ki eşit. ama iletişimde eşitlik mesaj adedi değildir. biri kalbini döküyor, diğeri tek heceyle savuşturuyorsa, o sohbeti taşıyan tek kişi vardır ve diğeri sadece oradadır. kullanıcı bunu bir bakışta hisseder; motor hissetmiyorsa, motor kördür.

skoru mesaj uzunluğuna ve duygu yüküne duyarlı hale getirdim. artık uzun, yatırım yüklü mesajlarla tek heceli geçiştirmeleri aynı kefeye koymuyor. şimdi o sohbete "konuşmayı taşıyan sensin, diğeri sadece orada" diyor. ama burada bir tuzak vardı: motoru "tek taraflı bulmaya" fazla hevesli hale getirirsem, bu sefer dengeli sohbetleri de yanlış okurdu. o yüzden düzelttikten sonra gerçekten dengeli bir sohbetle tekrar test ettim — hâlâ "eşit" diyor. yani agresifleştirmedim, doğrulttum.

bu bana ürünün ne olduğunu hatırlattı: bu bir mühendislik gösterisi değil, bir ayna. birine "sana ilgi var mı" diye sorduğunda, aldığı cevap onun içinde zaten bildiği ama dışarıdan duymak istediği şey olmalı. motor kullanıcının aynada gördüğünden başka bir şey söylüyorsa, ne kadar doğru sayarsa saysın, yanlıştır.

ders: bir modelin dürüstlüğü, matematiksel olarak haklı olması değil, kullanıcının hissettiğiyle aynı şeyi söylemesidir. sayı doğru olabilir ama his yanlışsa, ürün yalan söylüyordur.
