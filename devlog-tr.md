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
