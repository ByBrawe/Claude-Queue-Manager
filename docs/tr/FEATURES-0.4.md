## 0.4.3: mesaj kutusunun üstünde yönetim

- /qm yönetimi mesaj kutusunun üstünde açar. /qm close kapatır. Kuyruk boşken kalıcı QM şeridi görünmez. Ayrıntılar düğmesi tekrar girişi ve istatistikleri açar.
- /qm side isteğe bağlı yan paneli açar; yerleşimi Claude belirler. /qm inline mesaj kutusuna döner.
- Silme, düzenleme ve sıralama satır numarası yerine görev kimliğini kullanır. Undo tamamlanmış işleri geri getirmez. Pause hata sonrasında da korunur; recover yalnızca yeniden açılmış oturumda sahipsiz kalmış görevi kurtarır.
- /clear bekleyen işleri yeni oturuma duraklatılmış olarak taşır. Kaynak kopya yeniden çalıştırılamaz; kesilen taşımanın kurtarılması için saklanır.
- 200/500 görev ve görev başına 20.000 karakter sınırlarına ek olarak kuyruk başına 2.800 KiB ve tüm eklenti için 4 MiB depolama sınırı uygulanır. Önce eski undo/geçmiş budanabilir; bekleyen/çalışan iş silinmez. Sığmayan ekleme mevcut kuyruğu değiştirmeden reddedilir.
- Restore ve web için yerel Node.js 20+ gerekir; normal kuyruk arayüzünde gerekmez. Restore, ayrı Claude işlemlerinin aynı kaynağı almasını dosya kilidiyle engeller. Önce kaynak oturumu kapat. Çökme sonrası eski kilit kalırsa hata dosya yolunu gösterir; iki kuyruğu inceleyip ilgili oturumları kapattıktan sonra eski kilidi elle kaldır. Kilit otomatik ele geçirilmez.

# QM 0.4.0: güvenilir kuyruk ve otomasyon rehberi

QM, Claude Desktop'ın **yerel Code sekmesinde** veya Claude Code terminalinde çalışır. Normal Claude Chat ekranında çalışmaz. Komutların yazılışı İngilizcedir; görev metinlerini Türkçe yazabilirsin.

## Güvenli başlangıç

```text
/qm pause
/qm verify marker
/qm retry 2 5s
/qm timeout 10m
/qm context 85
/qm onfail pause
/qm batch Testleri düzelt || Build al || Sonuçları özetle
/qm
/qm resume
```

- **Akıllı doğrulama:** Varsayılan `/qm verify off` modunda Claude'un normal cevap vermesi tamamlandı sayılır; bu **testlerin geçtiğini kanıtlamaz**. `/qm verify marker` görev yanıtının sonunda `QM_PASS` veya `QM_FAIL` ister. İşaret yoksa `unknown` sayılır ve kuyruk durur. `/qm verify ai haiku` ayrı bir Claude model çağrısıyla görev ve **son yanıtı** değerlendirir. Bu seçenek **ek model kullanımı** oluşturur; dosyaları bağımsız incelemez, testleri çalıştırmaz. Belirsiz sonuçlarda kuyruk durur.
- **Retry:** `/qm retry 2 5s` hata veya süre aşımından sonra en fazla iki ek deneme yapar; denemeler arasında 5 saniye bekler. Varsayılan 0; en fazla 5 retry. `/qm retry last` son başarısız/belirsiz görevi elle öne ekler ve kuyruğu inceleme için duraklatır. Deploy gibi yan etkili görevlerde retry risklidir.
- **Timeout:** `/qm timeout 10m` bir görev 10 dakikayı aşarsa görev **bittiğinde** bunu süre aşımı olarak işaretler. Çalışan görevi **zorla kesmez**. Kapatmak için `/qm timeout off`.
- **Context takibi:** `/qm context 85` Claude Code'un raporladığı **gerçek context yüzdesini** okur ve sonraki görevi başlatmadan önce %85'e ulaşıldıysa kuyruğu durdurur. `/qm context` güncel bilgiyi gösterir; `/qm context off` kapatır. API bilgi sağlamazsa `bilinmiyor` görünür; QM token uydurmaz. Yeni kuyruk turunda 200K context kendiliğinden sıfırlanmaz.
- **Koşullu görev:** `/qm if success <görev>` ve `/qm if failure <görev>`, **son çalıştırılan görevin** sonucuna göre ilerler (atlanmış koşullar sonucu değiştirmez). Sonuç yoksa koşullu adım atlanır. Varsayılan `/qm onfail pause`, hata durumunda durdurur. `/qm onfail continue`, retry bittiğinde başarısızlık dalına geçmeyi sağlar. `unknown` her zaman durur.
- **Oturum kurtarma:** Kuyruk Claude Code'un oturuma özel `$.store` alanında tutulur. Uygulama kapanırken çalışan bir görev **kendiliğinden yeniden gönderilmez**. Önce kontrol et, ardından `/qm recover` ile kuyruğun başına al (duraklatılmış olarak). `/qm sessions` eski kuyrukları listeler. `/qm restore OTURUM_ID` duraklatılmış kaynağı boş oturuma **taşır** ve eski kuyruğu emekliye ayırır. Kaynakta çalışan görev varsa `/qm restore OTURUM_ID recover` ile tekrarlama riskini açıkça kabul etmen gerekir. Eşzamanlı iki uygulama arasında tam atomik işlem garantisi yoktur; eski oturumu kapat.
- **Geçmiş ve analizler:** `/qm history 20` son görev sonuçlarını ve sürelerini; `/qm stats` başarı, başarısızlık, timeout, atlama, retry ve ortalama süreyi gösterir. Oturum başına en fazla 250 ayrıntılı geçmiş kaydı saklanır; toplam sayaçlar korunur. Yerel `/qm` panelinde ve `/qm web` arayüzünde özetler görünür. `/qm settings` ayarları gösterir.

## Koşullu akış örneği

```text
/qm pause
/qm verify marker
/qm retry 1 10s
/qm onfail continue
/qm add Tüm testleri çalıştır ve sorunları gider
/qm if success Sürüm notlarını yaz
/qm if failure Test hatasını incele ve çözüm öner
/qm resume
```

İlk görev başarılıysa başarı dalı, retry sonrasında başarısızsa hata dalı çalışır; diğer dal atlanır.

**Uyarı:** `QM_PASS` Claude'un kendi beyanıdır; testlerin gerçekten geçtiğinin teknik kanıtı değildir. AI doğrulaması ek maliyet çıkarır. Timeout çalışan işi iptal etmez. Retry veya kurtarma aynı işi iki kez yaptırabilir. Eski `/qm` ve `/qm web` özellikleri korunur. Uzun kuyruklardan önce `claude plugin validate ./plugins/qm` komutunu ve iki kısa görevlik gerçek Desktop testini yap.

[Türkçe rehber](README.md) · [English guide](../en/FEATURES-0.4.md) · [20 dil](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager)

### Claude Desktop: `/qm` komutu görünmüyorsa (v0.4.1)

Claude Desktop sürümlerinde modların dinamik slash komutları tanınmayabiliyor ([Anthropic #99691](https://github.com/anthropics/claude-code/issues/99691)). QM v0.4.1, `/qm` komutunu oturumun ilk adımı olarak kaydeder, yükleme hatasını görünür gösterir ve kuyruk boşken bile yazma alanının üstünde **QM** düğmesi sunar. Bu düğme, modelden yanıt istemeden gerçek QM panelini açar. Düğme de yoksa mod oturuma yüklenmemiş ya da Desktop bu arayüzü göstermiyor olabilir. Normal **Chat** sekmesi değil, yerel **Code** oturumu kullan; eklentiyi etkinleştirip yeni oturum aç. Eklentiyi güncelledikten sonra `/reload-plugins` veya uygulamayı yeniden açmayı deneyebilirsin.

