# whatdoyoumean — yapım günlüğü

build-in-public anlatı defteri. her giriş bir reels/vlog parçası: önce hook, sonra "şunu şu yüzden ekledim".
damla seslendirir. teknik ama insanca, madde listesi değil anlatı.

---

## 00 — "sohbeti at, ne demek istediğini söyleyeyim"

hook: telefonundaki o sohbeti kimseye gösteremiyorsun ama "acaba bana mı yazıyor" diye günlerce düşünüyorsun. işte tam onu okuyan bir site yapıyorum.

theyseeyourphotos diye bir site var, bir fotoğrafını atıyorsun sana dair ürkütücü şeyler söylüyor. ben aynı hissi mesajlaşma üzerine kurmak istedim. sohbetini veriyorsun, motor alt-metni okuyor: flört mü ediyor arkadaşça mı, kim daha çok istiyor, yeşil bayrak mı kırmızı bayrak mı.

ama en başta bir karar verdim, çünkü herkes bugün bir yapay zekanın önüne kutu koyup "wrapper" yapıyor ve ben onu yapmayacağım. bu yüzden motoru kademeli kurdum. önce bizim kendi istatistik modelimiz senin tarayıcında çalışıyor, veri telefonundan çıkmıyor. model eminse cevabı biz veriyoruz. sadece emin olmadığı zor vakada, senin onayınla buluta soruyoruz. o zor vakaların cevabı da modeli tekrar eğitmek için birikiyor, yani zamanla buluta hiç ihtiyaç kalmıyor. gpu da gerekmiyor çünkü bu derin ağ değil, istatistik. kvkk da çözülüyor çünkü çoğu analiz cihazda kalıyor. tek kararla üç sorunu birden çözdüm.

bugün iskeleti kurdum. repoyu açtım, klasörleri dizdim, motorun ne öğreneceğine karar verdim: sohbetin tonu (flört / arkadaşça / soğuk / gergin) öğrenilecek, ama "kim daha çok istiyor" gibi şeyler öğrenilmeyecek, onları saf istatistikle sayacağım çünkü orada uydurmaya yer yok. isim de netleşti: whatdoyoumean.

---

## 01 — "kendi motorumu bir gecede eğittim, gpu yok"

hook: herkes chatgpt'ye kutu koyup uygulama diyor. ben bir sohbetin tonunu okuyan modeli kendim eğittim, hem de ekran kartı olmadan.

motor şu: bir sohbeti alıyor, dört tondan birine koyuyor. flört, arkadaşça, soğuk, gergin. bunu öğrenmek için önce elimle yüz yirmi tane küçük türkçe sohbet yazıp etiketledim. sonra klasik yöntemle, tf-idf artı lojistik regresyonla eğittim. bu derin ağ değil istatistik, o yüzden laptopun işlemcisinde saniyeler sürüyor, gpu falan gerekmiyor. tuttuğum kenarda test ettim, yüzde yetmiş dokuz çıktı. küçük veriyle dürüst bir rakam, büyüdükçe artacak.

en kritik detay şuydu: model laptopumda python ile eğitiliyor ama senin tarayıcında javascript ile çalışacak. ikisi aynı özellikleri birebir çıkarmazsa model çöp olur. o yüzden özellik çıkarıcıyı iki dilde birebir yazdım ve bir de parity testi ekledim, python neyi hesaplıyorsa node aynısını hesaplıyor mu diye kontrol ediyor. fark on üzeri eksi on altı çıktı, yani sıfır. artık ağırlıkları küçük bir json olarak tarayıcıya koyuyorum, mesajın telefonundan hiç çıkmadan cevabı orada üretiliyor.

bir şeyi de bilerek modele öğretmedim: "kim daha çok istiyor" sorusunu. onu saymayla buluyorum, kim daha uzun yazmış, kim çift mesaj atmış, kim soru soruyor. çünkü orada uydurmaya gerek yok, sayı zaten ortada. bayrakları da öyle, "konumunu aç", "saçmalama", "boşver" gibi kalıpları kural olarak yakalıyorum. model sadece işin gerçekten muğlak olan kısmını, tonu tahmin ediyor.

## 02 — "cevabı sohbet baloncuğu gibi bastım, çünkü konu mesajlaşma"

hook: bir analiz aracı yaptım ama tablo gibi değil, tam senin telefonundaki sohbet gibi görünüyor.

tasarımda tek bir his istedim: kişi sohbetini yapıştırınca kendi konuşmasını baloncuklar halinde geri görsün, altına da okumayı koyayım. üstte büyük tek kelime tonu söylüyor, sonra flört sinyali yüzdeyle bir çubukta, sonra kim daha çok istiyor, sonra seçtiğim birkaç mesajın "aslında ne demek istendiği", en altta da tek vuruşluk bir kapanış cümlesi. hepsi şablon, uydurma hikaye yok, her cümle gerçekten hesapladığım bir sayıya bağlı.

renk kullanımını duruma bağladım. flört ve kırmızı bayrak sıcak kırmızı, sağlıklı sinyaller yeşil, soğukluk maviye çalan gri. keskin köşeler, mor yok, gradient yok, süs yok. ilk girişte küçük bir açıklama çıkıyor: nasıl çalışır, veri neden telefonunda kalır. bir de günlük ücretsiz okuma sayacı koydum, çünkü bu ürün baştan paywall ile doğuyor. şimdilik ekran görüntüsü ve whatsapp sekmeleri "yakında" yazıyor, sıradaki iş onları açmak ve emin olmadığı vakada buluta sorma kısmını kurmak.

---

## 03 — "veri toplayan her ürün, aynı gün gizlilik ile doğar"

hook: çoğu uygulama "sonra ekleriz" diyor. ben mesajı işleyen ilk satırla birlikte gizliliği de yazdım.

burada hassas bir şey var: kişi başkasının da olduğu bir sohbeti yüklüyor. o yüzden iki şey koydum. biri, girişin hemen altında bir onay kutusu: "bu sohbet bana ait ya da paylaşma hakkım var". işaretlemeden buluta gönderemiyorsun. ikincisi, gerçek bir kvkk ve gdpr aydınlatma metni. özü şu: analiz varsayılan olarak cihazında, mesajın sunucuya gitmiyor, saklanmıyor. sadece emin olmadığımız vakada, senin onayınla o tek sohbet buluta gidiyor, orada da loglanmıyor. reklam çerezi, takip yok.

## 04 — "emin değilsem bunu saklamıyorum, sana söylüyorum ve soruyorum"

hook: çoğu yapay zeka emin olmadığında bile kendinden emin konuşur. benimki emin değilse bunu açıkça yazıyor.

kademeli motorun kalbini bağladım. model bir sohbete baktığında bir de güven marjı üretiyor. marj düşükse, yani en yakın iki ton birbirine çok yakınsa, cevabın üstüne "bu vakada emin değilim, sinyaller karışık" notunu koyuyorum ve "buluta sor" düğmesi çıkıyor. bastığında sohbet, onay kutusu işaretliyse, isim taşımadan bir cloudflare worker'ına gidiyor, o da gemini'ye soruyor ve cevabı aynı sohbet baloncuğu ekranında "buluttan" etiketiyle gösteriyor. worker gemini anahtarını saklayan tek yer, içeriği loglamıyor, dakikada ve günde ip başına sınırı var. şu an kapalı geliyor çünkü her çağrı para, damla kendi google anahtarını girip açacak. güzel taraf şu: bu buluta giden zor vakalar ileride modeli yeniden eğitmek için birikip fallback'i küçültecek.

---

## 05 — "ekran görüntüsünü de okuyor, üstelik kimin yazdığını baloncuğun yerinden anlıyor"

hook: sohbeti yazmak zor, çoğu insan ekran görüntüsü atıyor. ben görüntüyü okuyorum ama düz metne çevirip bırakmıyorum.

ekran görüntüsü sekmesini açtım. bir sohbet fotosu seçiyorsun, tesseract ile cihazında türkçe okunuyor, görsel hiçbir yere gitmiyor. asıl numara şu: chat ekranlarında bir kişinin baloncukları solda, diğerininki sağda durur. o yüzden her satırın x konumuna bakıp "sol" ve "sağ" diye ayırıyorum, yani kimin yazdığını tahmin ediyorum. çıkan metni düzenlenebilir şekilde yapıştır kutusuna koyuyorum, sen de "bu sohbette ben hangisiyim" diye seçiyorsun. yanlış olduysa elle düzeltebiliyorsun.

whatsapp sekmesini de açtım. sohbeti dışa aktarıp .txt ya da .zip olarak veriyorsun, zip'i tarayıcıda açıp içinden _chat.txt'yi çıkarıyorum, hepsi cihazında. böylece üç giriş yolu da (yapıştır, ekran görüntüsü, whatsapp) aynı okuma motoruna iniyor.

---

## 06 — "kendi supabase'imi açmadım, damlahelloworld'ün ortak hesabına bağladım"

hook: her uygulama kendi kullanıcı sistemini kurunca dağılıyorsun. ben whatdoyoumean'i şirketin ortak kimlik sunucusuna bağladım.

paywall'ın iskeletini kurdum ama sıfırdan bir backend açmadım. damlahelloworld'ün tek ortak supabase projesi var, tüm uygulamalar onu kullanacak, ben de whatdoyoumean'i ona bağladım. tablolarımı wdym_ önekiyle açıyorum ki aynı projede diğer uygulamalarla karışmasın. giriş şifresiz: e-postana bir bağlantı gidiyor, tıklıyorsun, giriyorsun. premium durumu kullanıcının profilinden okunuyor, satırı sadece o kişi görebiliyor, kimse tarayıcıdan kendini premium yapamıyor çünkü o alan sunucu tarafında açılacak.

her şeyi de kırılmaya karşı yazdım: supabase yüklenmezse ya da tablo henüz açılmamışsa uygulama çökmüyor, herkes ücretsiz sayaçla devam ediyor. günlük hak dolunca premium ekranı çıkıyor, şimdilik "yakında" çünkü ödeme sağlayıcısı (paddle mı lemon squeezy mi) damla'nın kararı. bir de ortak projeye çalıştırması için hazır sql şemasını repoya koydum.

---

## 07 — "modelim kavgayı flört sanıyordu, sayılara veto hakkı verdim"

hook: yapay zeka ürünlerinin en tehlikeli anı, emin bir sesle yanlış konuşması. benimki bir kavgaya "yüzde 63 flört" dedi. bugün ona haddini bildirdim.

ürünü bir müşteri gibi baştan sona gezdim ve üç ağır hata yakaladım. tek taraflı ölü bir sohbete "flört yüzde 99" diyordu çünkü "özledim seni" kelimelerini görüyor ama kimin yazdığına bakmıyordu. sorgu suali bir kavgaya "flört havası" diyordu çünkü soru işaretlerini ilgi sanıyordu. üstelik aynı ekranda dört kırmızı bayrak basıp kapanışta "birileri diğerini merak ediyor" diye romantik cümle kuruyordu, yani kendi kendiyle çelişiyordu.

çözüm iki katmanlı. bir: istatistik model artık sadece öneriyor, sayılabilir sinyaller hükmü kesiyor. iki ayrı kırmızı bayrak türü varsa flört hükmü geçersiz, gerginlik kazanır. yakınlık dili tek taraftan akıyorsa ve karşı taraf kısa cevap + erteleme yapıyorsa hüküm "tek taraflı" olur, flört sinyali de tek sayı yerine "sende yüzde 40, onda yüzde 0" diye iki taraflı gösterilir. iki: veriyi büyüttüm, 169 örnekten 211'e, tam da bu üç karışıklığı hedefleyen örneklerle. doğruluk yüzde 79'dan 83.7'ye çıktı.

açıklamalar da somutlaştı. "kim daha çok istiyor" artık kanıtını da söylüyor: mesaj 9–5, soru 3–0, hep senden yana. mesaj okumaları artık sohbetin tamamını tarıyor, aynı cümleyi iki kez söylemiyor, sorgu cümlesini "gerçek bir soru" diye övmüyor. en alta bir "nasıl okudum?" bölümü koydum: kaç mesaj sayıldı, model ne dedi, hangi sayımlar hükmü değiştirdi. ve reveal artık seni bekletmiyor: baloncuk araları kısaldı, ekrana dokununca hepsi anında iniyor.

bir de günlük 5 okuma sınırını ve premium ekranını tamamen söktüm. bu ürün ücretsiz bir fikir aracı, yayılsın diye var; kapıya turnike koymanın alemi yoktu.

---
---

# inşa hikayesi reels serisi (instagram build-in-public)

format: her giriş 30-60 saniyelik reel scripti, ilk cümle hook; post ya da carousel'e de çevrilebilir.
yukarıdaki 00-07 oturum devlogları; bu seri aynı hikayenin baştan anlatılan tam yayı. sınır yok.


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

---
---

# minik parçalar (instagram: reel / post / carousel)

format: olabildiğince küçük kesitler, çok içerik. her biri 30-60 saniyelik hook'lu reel; (post) ve
(carousel) etiketi uygun olanlara öneri. hepsi gerçek koddan ve gerçek kararlardan.
anlatım biçimi damla'nın numaralı zinciri, konuşma dilinde: "bugün şunu değiştirdim arkadaşlar,
çünkü şöyle bir sorun vardı" — önce sorun/his, sonra değişiklik, sonra altındaki karar.

## m01 — "javascript'in toLowerCase fonksiyonu türkçede yanlış çalışıyor" (reel)

hook: modelim "İstanbul" kelimesini tanımıyordu. suçlu javascript çıktı.

türkçede büyük İ küçülünce noktalı i olur, büyük I ise ı olur. javascript'in standart toLowerCase'i bunu bilmez, İ'yi bozuk bir şeye çevirir. model eğitimim python'da doğru yapıyordu, tarayıcı yanlış yapıyordu, yani aynı kelime iki tarafta farklı token oluyordu. çözüm: kendi lowerTr fonksiyonumu yazdım, yedi türkçe harfi elle eşliyor. bir harf yüzünden iki saat. ama artık "Şaka ŞAKA şaka" üçü de aynı kelime.

## m02 — "neden sadece dört duygu var: flört, arkadaşça, soğuk, gergin" (post)

hook: sohbet analizim sadece dört kelime biliyor ve bu bilinçli bir karar.

ilk hevesim on iki sınıftı: kıskanç, pasif agresif, mesafeli, umutsuz... sonra durdum. her sınıf için yüzlerce elle etiketli örnek gerekiyor ve sınıflar birbirine karıştıkça model hepsinde kötüleşiyor. dört sınıf seçtim çünkü dört tanesi birbirinden gerçekten ayrılıyor: flört, arkadaşça, soğuk, gergin. kıskançlık ayrı sınıf değil, gerginliğin bir kokusu; onu bayraklar yakalıyor. az sınıf, net sınır, dürüst doğruluk.

## m03 — "bir gecede 120 sohbet uydurdum ama modelime yalan söylemedim" (reel)

hook: veri setimin ilk 120 örneğini kendim yazdım. bu hile değil mi? değil, ve farkı şu.

tohum veri diye bir şey var: modele ilk yürümeyi öğreten küçük, elle yazılmış set. "A: dün gece neredeydin B: arkadaşlardaydım" gibi mini sohbetler yazıp tek tek etiketledim. hile olan bunu saklamak olurdu. ben doğruluğu bu setin dışında tuttuğum örneklerle ölçüyorum ve sayıyı olduğu gibi söylüyorum: yüzde 83.7. veri büyüdükçe bu sayı da değişecek, o da görünür olacak.

## m04 — "❤ ile 🖤 aynı şey mi? modelime göre evet ve bu bir karardı" (post)

hook: yirmi bir farklı kalp emojisi saydım. hepsini tek sinyala indirdim.

kırmızı kalp, siyah kalp, iki pembe kalp, kalpli surat... hepsinin ayrı anlamı olduğuna dair teoriler var. ama benim veri setimde her birinden üçer örnek yok, o yüzden ayrı ayrı öğrenilemezler. hepsini tek sayaçta topladım: mesaj başına kalp yoğunluğu. kaba ama dürüst. veri bine çıkınca siyah kalbin ironisini ayrı öğrenmek isterim; bugün öğrenmeye kalkmak ezber olurdu.

## m05 — "üst üste mesaj atmak bir veri noktası" (reel)

hook: karşı taraf cevap vermeden ikinci mesajı yazdıysan, bunu bir sayaç saydı.

motorumdaki en sevdiğim sinyallerden biri çift mesaj oranı. sen yazdın, cevap gelmeden bir daha yazdın: bu bir uzanma hamlesi. bir kere olması hiçbir şey; oranı yükselince "kim daha çok istiyor" dengesinde ağırlık yapıyor. kimse mesajlarını okumadan, sadece kim-ne-zaman-yazdı deseninden çıkan bir içgörü. istatistiğin güzelliği bu: mahremiyete girmeden örüntüyü görmek.

## m06 — "whatsapp'ın tarih formatı beni üç regex'e mal oldu" (carousel)

hook: aynı uygulama, üç farklı tarih formatı. whatsapp dışa aktarımı bir kabus.

iphone köşeli parantezle veriyor, saat önce mi tarih önce mi cihaza göre değişiyor, android tire koyuyor, bazı bölgeler öğleden sonra için ÖS yazıyor. yapıştırılan sohbeti temizlemek için üç ayrı zaman damgası deseni tanıyorum ve hangisi tutarsa onu soyuyorum. kullanıcı bunların hiçbirini görmüyor; yapıştırıyor, çalışıyor. iyi ürünün altında hep böyle görünmez hamallık var. (carousel: 3 format ekran görüntüsü + regex)

## m07 — "ekran görüntüsünde kimin yazdığını baloncuğun yerinden anlıyorum" (reel)

hook: fotoğraftaki yazıyı okumak kolay. kimin yazdığını bilmek asıl numara.

ocr sana düz metin verir: kim demiş belli değil. ama chat ekranlarının evrensel bir kuralı var: senin baloncukların sağda, karşınınki solda. her satırın sayfadaki x konumuna bakıp konuşmacıyı tahmin ediyorum. yanılırsam kullanıcı tek dokunuşla düzeltiyor. görsel bu arada hiçbir yere gitmiyor, okuma cihazda oluyor. basit geometri, sıfır sihir, çalışıyor.

## m08 — "api anahtarım neden tarayıcıda durmuyor" (post)

hook: frontend'e api anahtarı koyan herkes onu internete koymuş demektir.

bulut fallback'i için bir dil modeli anahtarı gerekiyor. onu tarayıcıya koyarsan f12 açan herkes alır, faturanı şişirir. benim anahtarım bir cloudflare worker'da gizli değişken olarak duruyor; uygulama worker'la kendi belirlediğim bir uygulama anahtarıyla konuşuyor, worker da ip başına hız sınırı koyuyor ve içerik loglamıyor. sıkıcı üç saat, ama ürünü halka açmanın bedeli bu üç saat.

## m09 — "safari kullanıcılarım bir gün siteyi bozuk gördü ve suçlu cache'ti" (reel)

hook: sitem chrome'da çalışıyor, safari'de çöküyordu. kod aynıydı. dosyalar aynı değildi.

javascript modülleri birbirini import eder. yeni sürüm attığımda safari bazı dosyaların yenisini, bazılarının eskisini tutmuş; iki sürümün yarısı birleşince site çöktü. çözüm: her import'a sürüm damgası. dosya adının sonuna v kaç yazıyorum, sürüm atınca hepsini birlikte değiştiriyorum, tarayıcı hepsini birden tazelemek zorunda kalıyor. artık deploy ederken footer'a da sürümü basıyorum: v11. hangi sürüme baktığını herkes görsün.

## m10 — "onboarding ekranım bir sohbet, çünkü ürünün kendisi bir sohbet" (post)

hook: hoş geldin ekranında madde işaretleri yok. uygulama sana mesaj atıyor.

ilk açılışta dört baloncuk düşüyor: ben sohbetlerin altını okuyorum, bir konuşma yapıştır, modelim senin cihazında çalışır, emin olamazsam onayınla buluta sorarım. ürün ne yapıyorsa onboarding onu yapıyor: mesajlaşıyor. kullandığın metafor ürünün her hücresine sızmalı yoksa dekor olarak kalıyor. en kısa tasarım dersim bu oldu.

## m11 — "arka plandaki balonlar imlecinden kaçıyor ve bu bir fizik motoru" (reel)

hook: sitemin arka planı süs değil, katı cisim simülasyonu.

balon denizi dediğim katman: baloncuklar birbirine çarpıp sekiyor, imlecin yaklaşınca kaçıyor, içerik kartlarının altına girmiyor. ilk sürümde iç içe geçiyorlardı çünkü görsel çapla çarpışma çapı farklıydı; her balonu çarpışma çapında çizince katılaştılar. koyu temadaki balonlar da hazır ikon değil: damla'nın ürettiği dokulu görsellerden tek tek kesildi. detay mı? evet. ama premium his dediğin şey bu detayların toplamı.

## m12 — "plan teklifine 'bakarız' cevabı gelirse, o plan yeşil bayrak değil" (reel)

hook: motorum "buluşalım" kelimesini görünce yeşil bayrak basıyordu. bir vaka bunu yüzüme çarptı.

"sergiye gidelim mi" dedin, "bakarız" geldi. eski motor "plan yapma var, ilgi harekete geçiyor" diye seviniyordu. ama savuşturulmuş plan tam tersi sinyaldir. artık plan cümlesinden sonraki iki mesaja bakıyorum: karşı taraf erteleme kelimesiyle döndüyse o plan yeşil bayrak olarak sayılmıyor. tek kelimelik fark, taban tabana zıt okuma. alt-metin işi tam olarak bu.

## m13 — "modelim dört mesajlık sohbete hüküm veremez ve artık bunu itiraf ediyor" (post)

hook: "selam naber, iyidir, çıkıyor muyuz, bakarız." bu dört satırdan kişilik analizi çıkaran her araç yalan söylüyor.

kısa kesitte sinyal azdır; istatistik bunu bilir ama kullanıcı arayüzleri genelde saklar. benim çözümüm: altı mesajdan kısa sohbetlerde analiz yine çalışıyor ama hükmün altına açık bir uyarı düşüyor: kısa bir kesit bu, okuma sınırlı, kesin hüküm yok. ve sistem kendini "emin değilim" moduna alıyor. güven, her soruya cevap vermekten değil, ne zaman susacağını bilmekten çıkıyor.

## m14 — "gottman'ın kırmızı bayrağını regex'e çevirdim" (reel)

hook: ilişki biliminin en ünlü bulgusunu bir kelime listesine indirdim ve utanmıyorum.

john gottman'ın araştırmalarında ilişkinin en zehirli sinyali küçümseme: "abartıyorsun, saçmalama, takıntı yapma." motorum bu ifadeleri sayıyor ve geçtiyse küçümseme bayrağı basıyor, kaynağını da söylüyor. derin model değil, kelime avı; ama bilimsel bir bulguya bağlı, sayılabilir ve her seferinde aynı kararı veriyor. uydurma içgörüden yüz kat değerli.

## m15 — "analiz ekranım seni bekletiyordu. özür yerine dokunma koydum" (reel)

hook: sonucu bilerek yavaş gösteriyordum. dramatik olsun diye. kullanıcı sıkıldı.

reveal'i mesajlaşma gibi kurgulamıştım: yazıyor animasyonu, baloncuk, bekle, sıradaki. yedi sekiz saniye sürüyordu ve ilk gerçek kullanıcım "neden bu kadar uzun" dedi. dramı öldürmeden çözdüm: aralar yüzde altmış kısaldı ve ekrana dokunursan kalan her şey anında iniyor. sabırlı kullanıcı sinematik akışı alıyor, aceleci kullanıcı cevabını alıyor. bekletme bir tasarım tercihiyse, atlatması da tercih olmalı.

## m16 — "yüzde 99 flört yazan ekranı sildim, yerine iki sayı koydum" (carousel)

hook: tek sayı bazen koca bir yalandır. yüzde 99 flört: doğru ama seni aldatır.

tek taraflı sohbette flört dili gerçekten var, ama tamamı senden. eski ekran tek sayı basıyordu: yüzde 99. yeni ekran iki çubuk gösteriyor: sende yüzde 40, onda yüzde 0. aynı veri, bambaşka gerçek. sayıyı yükselten kelimelerin kimden geldiğini söylemeyen her metrik eksik anlatıdır. (carousel: eski ekran / yeni ekran / "hangi soruyu soruyorsun" kapanışı)
