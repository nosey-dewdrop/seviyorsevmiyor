# whatdoyoumean — inşa hikayesi (linkedin)

format: numaralı zincir. her giriş tek başına 30-60 saniyelik bir reel, ilk cümle hook.
kural: her adımın altındaki KARAR anlatılır, süreç gösterilir. hepsi gerçek tarihçeden, uydurma adım yok.

---

## 1 — "bir siteye fotoğraflarımı verdim, bana kim olduğumu söyledi. ben de aynısını mesajlara yapmak istedim"

theyseeyourphotos diye bir site var: fotoğrafını atıyorsun, google'ın gözünden senin hakkında ne çıkarılabileceğini yüzüne söylüyor. ürkütücü ve bir o kadar bağımlılık yapıcı. ben o hissi başka bir yerde aradım: hepimizin telefonunda duran, defalarca ekran görüntüsünü arkadaşlarımıza atıp "sence ne demek istedi" diye sorduğumuz sohbetlerde. amaç buydu: bir sohbeti yapıştır, altındaki alt-metni oku. flört mü, arkadaşça mı, kim daha çok istiyor, yeşil bayrak mı kırmızı mı. isim de kendiliğinden geldi: whatdoyoumean.

## 2 — "ilk taslak bana slopware hissi verdi, çünkü öyleydi: sohbeti alıp gemini'ye yollayacaktım"

en kolay yol belliydi: kullanıcının sohbetini al, bir LLM'e yolla, cevabı şık bir kutuda göster. bir akşam oturup düşündüm: bunun neresi benim ürünüm? bu bir api anahtarına giydirilmiş arayüz. üstüne iki dert daha: insanların en mahrem verisi olan mesajları benim sunucumdan geçecek ve her okuma bana para yazacak. üç sorun, tek kök: motorun benim olmaması. o gün "wrapper olmayacak" kararını verdim ve bu karar projenin geri kalan her şeyini şekillendirdi.

## 3 — "gpu param yok. sonra fark ettim: makine öğrenmesi dediğin şey istatistik, istatistik cpu'da çalışır"

kendi modelini eğit dediğinde herkesin aklına gpu kiraları geliyor. benim aklıma şu geldi: ton sınıflandırma dediğin şey aslında sayılabilir sinyaller. soru oranı, emoji yoğunluğu, hitaplar, mesaj uzunlukları, kelime örüntüleri. bunun için transformer değil, tf-idf artı lojistik regresyon yeter ve laptop işlemcisinde saniyeler içinde eğitilir. kararın altı: derin ağ prestijli, istatistik dürüst. küçük veriyle derin ağ ezberler; istatistik ne bildiğini ve bilmediğini söyler. elle etiketlediğim türkçe sohbetlerle ilk modeli eğittim.

## 4 — "modelim tarayıcının içinde çalışıyor, mesajların telefonundan hiç çıkmıyor"

madem model küçük bir katsayı listesi, onu json olarak dışa aktarıp tarayıcıya yükleyebilirim dedim. yani analiz kullanıcının cihazında oluyor, sohbet hiçbir sunucuya gitmiyor. bu tek kararla kvkk'nın en ağır sorusu kökten çözüldü: veriyi nasıl koruyorsun? almıyorum ki. üstüne bir de görünür dürüstlük koydum: karşı taraf o sohbetin paylaşılmasına onay vermedi, o yüzden "bu sohbeti paylaşma hakkım var" kutusu işaretlenmeden okuma yok. gizlilik sayfası da ilk sürümle aynı gün çıktı, sonradan yamanmadı.

## 5 — "peki model emin olamazsa? kademeli plan: önce ben, emin değilsem bulut, zamanla bulut da gidecek"

istatistik modelin zorlanacağı yer belli: nüans, sarkazm, karışık sinyaller. çözümüm kademeli mimari. model her cevapta bir güven payı üretiyor; eminse cevap cihazda bitiyor. emin değilse kullanıcıya soruyorum: istersen bu sohbeti buluta sorayım, onayınla. asıl numara üçüncü adımda: o zor vakaların cevapları yeni etiketli veri oluyor, modelim onlarla yeniden eğitiliyor, bulut ihtiyacı her turda küçülüyor. gemini burada beyin değil, geçici bir öğretmen. hedef, onu tamamen işten çıkarmak.

## 6 — "kim daha çok istiyor sorusuna yapay zeka cevap vermiyor. sayaç cevap veriyor"

ürünün en can alıcı çıktısı "kim daha çok istiyor" ve ben bunu bilerek modele vermedim. çünkü bu tahmin edilecek değil, sayılacak bir şey: kim daha uzun yazıyor, kim üst üste mesaj atıyor, kim daha çok soru soruyor, kim hitap kullanıyor. hepsi deterministik kural, yani aynı sohbete her seferinde aynı cevap ve her iddianın gösterilebilir bir kanıtı var. kararın altı: yapay zekanın uydurma lüksü var, sayacın yok. kullanıcıya "bence" değil "şu sayımlara göre" demek istedim.

## 7 — "python'da eğittiğim modeli javascript'te çalıştırıyorum. peki ikisi aynı şeyi mi hesaplıyor?"

eğitim python'da, çıkarım tarayıcıda javascript'te. özellik çıkarıcıyı iki dilde birebir aynı yazmak zorundaydım, yoksa model eğitildiği dünyadan başka bir dünyada karar verir ve bunu kimse fark etmez. bunun için parity harness kurdum: aynı sohbetler iki dilde de işleniyor, çıkan sayılar karşılaştırılıyor. fark on üzeri eksi on altı, yani makine hassasiyeti. sıkıcı iş, kimse reels'ini çekmez ama gerçek ürünle demo arasındaki çizgi tam burası: görünmeyen yerde de doğru olmak.

## 8 — "kimse sohbetini elle yazmaz. ekran görüntüsünü at yeter, kimin yazdığını baloncuğun yerinden anlıyorum"

metin yapıştırma çalışıyordu ama gerçek kullanıcı davranışı belli: insanlar ekran görüntüsü atar. tesseract ile görüntüyü cihazda okuyorum, görsel hiçbir yere yüklenmiyor. asıl sevdiğim detay: chat ekranlarında senin baloncukların sağda, karşınınki solda durur. her satırın x konumuna bakıp konuşmacıyı tahmin ediyorum. whatsapp dışa aktarımı da üçüncü kapı: .txt ya da .zip, tarayıcıda açılıyor. üç girdi de aynı normalize formata iniyor, motor tek. karar: girdi çeşitliliği ürün hissi verir, motor çeşitliliği bakım kabusu.

## 9 — "kullanıcı sistemi kurmuştum. çalışıyordu. söküp attım"

başta hesap sistemi vardı: e-postayla giriş, premium alanı, ortak supabase. sonra referans ürünüme dönüp baktım: theyseeyourphotos'ta hesap yok. giriyorsun, deniyorsun, ürpertiyle çıkıyorsun. sürtünme sıfır. benim ürünüm de tek atımlık bir fikir aracı, kimse mesajlarını analiz etmek için üyelik açmak istemez. üstelik hesap yoksa sunucuda veri de yok, kvkk hikayem daha da temiz. çalışan kodu silmek acıtıyor ama karar net: her özellik ürüne hizmet etmiyorsa ürünün üstünde yük.

## 10 — "doğuştan paywall koymuştum. onu da söktüm, çünkü bu ürünün işi para değil"

her ürünüme gelir modeliyle doğma kuralı koymuştum, buna da günlük beş okuma sınırı ve premium ekranı koydum. sonra stratejiye dönüp baktım: bu ürün fikir kanıtı ve kitle aracı, insanların paylaşası gelsin diye var. viral olması istenen bir şeye beşinci kullanımda turnike koymak kendi ayağına sıkmak. sınır kalktı, ücretsiz ve sınırsız. karar şu prensipten: para modeli ürünün amacına uyar, tersine değil. bu ürünün getirisi kullanıcı ve hikaye; kasa başka üründe.

## 11 — "ürünümü müşteri gibi gezdim ve modelim bir kavgaya yüzde 63 flört dedi"

son ürün testine oturdum: altı gerçek senaryo, baştan sona. sonuç yüz kızartıcı. sorgu suali bir kavgaya "flört havası" diyordu çünkü soru işaretlerini ilgi sanıyordu. tek taraflı ölü bir sohbete "flört yüzde 99" dedi çünkü "özledim" kelimesini görüyor, kimin yazdığına bakmıyordu. en kötüsü: aynı ekranda dört kırmızı bayrak basıp kapanışta "birileri diğerini merak ediyor" diye romantik cümle kuruyordu. kendi ürünüm kendi içinde çelişiyordu ve ben bunu ancak müşteri gözüyle bakınca gördüm. ders: kendi demo verinle test etmek kendini kandırmak.

## 12 — "çözüm: model öneriyor, sayılar veto ediyor"

o fiyaskoların çözümü daha büyük model değildi, güç dengesini değiştirmekti. artık istatistik model sadece öneri veriyor; sayılabilir sinyallerin veto hakkı var. iki ayrı kırmızı bayrak türü varsa flört hükmü düşüyor, gerginlik kazanıyor. yakınlık dili tek taraftan akıyorsa hüküm "tek taraflı" oluyor ve flört sinyali tek sayı yerine iki taraflı gösteriliyor: sende yüzde 40, onda yüzde 0. o tek satır bazen ürünün bütün cevabı. üstüne veriyi tam bu karışıklıkları hedefleyen örneklerle büyüttüm, doğruluk yüzde 79'dan 83.7'ye çıktı. karar: yanılabilen katman asla son sözü söylemez.

## 13 — "ürünüme 'nasıl okudum?' düğmesi koydum, çünkü kara kutuya kimse güvenmez"

kendi annem bile sonuca bakıp "peki bunu nereden bildin" diyecekti. artık her analizin altında açılır bir bölüm var: kaç mesaj sayıldı, kaçı senden kaçı ondan, model neye ne kadar güvendi, sayımlar modelin hükmünü çiğnedi mi, ve hepsi cihazında kaldı notu. denge iddiası da kanıtını yanında taşıyor: mesaj dokuza beş, soru üçe sıfır, hep senden yana. bekleme süresini de yüzde altmış kestim, ekrana dokununca her şey anında iniyor. karar: güven, doğruluk oranından değil hesap verebilirlikten çıkar.

## 14 — "sırada ne var: bu iskeleti kas tutacak üç şey"

dürüst durum tespiti: mimari hikaye sağlam ama 211 örnekle eğitilmiş bir model henüz küçük lig. yol haritam üç adım. bir: etiketli veriyi bine çıkarmak, çünkü bu motorun bütün vaadi veriyle keskinleşmesi. iki: bulut fallback'i canlıya alıp kademeli döngüyü gerçekten döndürmek, zor vakalar modele ders olsun. üç: veri büyüyünce berturk fine-tune koluna geçmek, istatistik tabanı yedekte kalsın. ve tabii en zoru: gerçek kullanıcı sayısı. süreci burada anlatmaya devam edeceğim, çünkü bu serinin kendisi de o kararlardan biri.
