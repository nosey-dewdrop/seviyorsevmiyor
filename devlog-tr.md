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
