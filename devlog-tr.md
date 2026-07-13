# whatdoyoumean — yapım günlüğü

build-in-public anlatı defteri. her giriş bir reels/vlog parçası: önce hook, sonra "şunu şu yüzden ekledim".
damla seslendirir. teknik ama insanca, madde listesi değil anlatı.

---

## 00 — "sohbeti at, ne demek istediğini söyleyeyim"

hook: telefonundaki o sohbeti kimseye gösteremiyorsun ama "acaba bana mı yazıyor" diye günlerce düşünüyorsun. işte tam onu okuyan bir site yapıyorum.

theyseeyourphotos diye bir site var, bir fotoğrafını atıyorsun sana dair ürkütücü şeyler söylüyor. ben aynı hissi mesajlaşma üzerine kurmak istedim. sohbetini veriyorsun, motor alt-metni okuyor: flört mü ediyor arkadaşça mı, kim daha çok istiyor, yeşil bayrak mı kırmızı bayrak mı.

ama en başta bir karar verdim, çünkü herkes bugün bir yapay zekanın önüne kutu koyup "wrapper" yapıyor ve ben onu yapmayacağım. bu yüzden motoru kademeli kurdum. önce bizim kendi istatistik modelimiz senin tarayıcında çalışıyor, veri telefonundan çıkmıyor. model eminse cevabı biz veriyoruz. sadece emin olmadığı zor vakada, senin onayınla buluta soruyoruz. o zor vakaların cevabı da modeli tekrar eğitmek için birikiyor, yani zamanla buluta hiç ihtiyaç kalmıyor. gpu da gerekmiyor çünkü bu derin ağ değil, istatistik. kvkk da çözülüyor çünkü çoğu analiz cihazda kalıyor. tek kararla üç sorunu birden çözdüm.

bugün iskeleti kurdum. repoyu açtım, klasörleri dizdim, motorun ne öğreneceğine karar verdim: sohbetin tonu (flört / arkadaşça / soğuk / gergin) öğrenilecek, ama "kim daha çok istiyor" gibi şeyler öğrenilmeyecek, onları saf istatistikle sayacağım çünkü orada uydurmaya yer yok. isim de netleşti: whatdoyoumean.
