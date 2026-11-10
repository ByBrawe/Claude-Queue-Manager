## 0.5.0 — Desktop, CLI ve web arayüzü

- Mesaj kutusu üstünde kompakt görünüm; Ayrıntılar ile görev işlemleri ve ileri bilgiler. Dar yan panelde tek sütun, tam genişlikte girişler; ayrı tekrar adedi ve mesajı.
- Bekleyen/çalışan/tamamlanan sayıları, belirgin Duraklat/Devam kontrolü, tekli ve toplu silmede onay, geri alma. TUI: Tab/Shift+Tab ile odak, Enter ile seçme, p ile duraklat/devam, q ile kapatma. Komut adları İngilizce kalır; /qm lang tr arayüzü ve yardım açıklamalarını Türkçeleştirir.
- Web: koyu mavi tema, oturum kimliği, iki sütun/tek sütun uyarlama, görev satırları ve sürükleme, çoklu seçim, ayrı tekrar girişi, kapalı geçmiş/istatistikler. Bağlantı kesilirse taslak korunur ve otomatik yeniden bağlanılır. Başarı yalnızca modun kayıt onayından sonra gösterilir.

### Claude kendi listesini oluşturabilir

Resmi **mcp__qm__queue** aracıyla Claude aynı oturumun kuyruğunu okuyabilir, görev ekleyebilir, bekleyen kimlikleri sıralayabilir/silebilir ve kuyruğu duraklatıp devam ettirebilir. Örnek istek: "Proje için inceleme, düzeltme, test ve özet görevlerinden kuyruk oluştur. Önce duraklat; ben onayladıktan sonra devam ettir."

Araç örnekleri: {"action":"list"}, {"action":"pause"}, {"action":"add","tasks":["Kodu incele","Testleri çalıştır"]}, {"action":"reorder","ids":[2,1]}, {"action":"remove","ids":[2]}, {"action":"resume"}. Sıralama tüm bekleyen kimlikleri bir kez içermelidir. Aktif görev değiştirilemez. Aktif tur sırasında eklenen işler mevcut tura gönderilmez. Araç kullanıldığında Claude bekleyen görev metinlerini bilinçli olarak okuyabilir; normal /qm komutlarının argüman gizleme davranışı korunur. Kuyruk yönetimi isteklerini tekrar tekrar kuyruğa ekletme.

### Bağlam verisi

Eski görünüm açılırken ölçüm yapmıyordu. Yeni native görünüm ve web snapshot resmi $.session.usage() API'sini sorgular. Host sayısal token/pencere döndürmezse neden veri gösterilemediği açıklanır; sahte değer üretilmez. Gateway/API ayarları değiştirilmez. Son kaydedilmiş ölçüm varsa korunabilir. Host hataları Claude debug günlüğüne yazılır. Özel gateway'in her durumda kullanım verisi sağlayacağı garanti edilmez.

## 0.4.3: mesaj kutusunun üstünde yönetim

- /qm yönetimi mesaj kutusunun üstünde açar. /qm close kapatır. Kuyruk boşken kalıcı QM şeridi görünmez. Ayrıntılar düğmesi tekrar girişi ve istatistikleri açar.
- /qm side isteğe bağlı yan paneli açar; yerleşimi Claude belirler. /qm inline mesaj kutusuna döner.
- Silme, düzenleme ve sıralama satır numarası yerine görev kimliğini kullanır. Undo tamamlanmış işleri geri getirmez. Pause hata sonrasında da korunur; recover yalnızca yeniden açılmış oturumda sahipsiz kalmış görevi kurtarır.
- /clear bekleyen işleri yeni oturuma duraklatılmış olarak taşır. Kaynak kopya yeniden çalıştırılamaz; kesilen taşımanın kurtarılması için saklanır.
- 200/500 görev ve görev başına 20.000 karakter sınırlarına ek olarak kuyruk başına 2.800 KiB ve tüm eklenti için 4 MiB depolama sınırı uygulanır. Önce eski undo/geçmiş budanabilir; bekleyen/çalışan iş silinmez. Sığmayan ekleme mevcut kuyruğu değiştirmeden reddedilir.
- Restore ve web için yerel Node.js 20+ gerekir; normal kuyruk arayüzünde gerekmez. Restore, ayrı Claude işlemlerinin aynı kaynağı almasını dosya kilidiyle engeller. Önce kaynak oturumu kapat. Çökme sonrası eski kilit kalırsa hata dosya yolunu gösterir; iki kuyruğu inceleyip ilgili oturumları kapattıktan sonra eski kilidi elle kaldır. Kilit otomatik ele geçirilmez.

# Claude Queue Manager (QM) — Kullanım rehberi

[🌐 Turkish / Türkçe](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM, Claude Desktop uygulamasındaki **Code** sekmesinde veya Claude Code terminalinde görevleri kuyruğa alır. Bir görev tamamlandıktan sonra sıradaki görevi **ayrı bir tur** olarak başlatır; devam eden işi yönlendirmez (steer yapmaz).

## “Devam et” ne demek?

`devam et` bir QM komutu değil, Claude'a gönderilecek **normal görev metnidir**. Görevleri Türkçe, İngilizce veya başka dillerde yazabilirsin. `/qm repeat 5 devam et`, `devam et` mesajını beş ayrı tur için sıraya koyar; çeviri yapmaz.

```text
/qm repeat 5 devam et
```

## Kurulum

Claude Code içinde aşağıdaki iki komutu çalıştır. Ardından Claude Desktop **Code** bölümünde yeni bir yerel oturum aç veya destekleniyorsa `/reload-plugins` kullan. Normal Claude Chat sekmesinde bu eklenti çalışmaz.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Güvenli başlangıç

Önce kuyruğu duraklat, görevleri topluca ekle, `/qm` panelinden sırayı kontrol et ve sonra devam ettir. Her tamamlanan ana turdan sonra yalnızca bir yeni görev başlatılır.

```text
/qm pause
/qm batch Başarısız testleri düzelt || Derlemeyi çalıştır || Değişiklikleri özetle
/qm
/qm resume
```

## Etkileşimli UI / TUI

Claude Desktop **Code** sekmesinde veya Claude Code terminalinde **`/qm`** yazınca panel açılır. Toplu görev yapıştırma, `5 | devam et` tekrar alanı, arama, 12 satırlık sayfalama, görev düzenleme, yukarı/aşağı taşıma ve iki aşamalı silme onayı vardır.

Panel dili: **Türkçe / English** açılır menüsünden veya `/qm lang tr` ve `/qm lang en` komutlarıyla seçilir. Rehberler 20 dilde olsa da panel arayüzü şimdilik iki dildedir. Sürüm uyumluluğu için gerçek Desktop üzerinde iki kısa görevle test et.

## Komut rehberi

| Komut | Komut rehberi |
| --- | --- |
| `/qm` | Kuyruk panelini aç |
| `/qm add devam et` | Tek görev ekle |
| `/qm repeat 5 devam et` | Aynı görevi 1–200 kez ekle |
| `/qm batch A \|\| B \|\| C` | Farklı görevleri belirtilen sırayla ekle |
| `/qm front devam et` | Görevi sıranın başına al |
| `/qm pause  /qm resume` | Otomatik çalışmayı duraklat / devam ettir |
| `/qm mv 3 1` | Bekleyen 3. görevi 1. sıraya taşı |
| `/qm edit 2 devam et` | Bekleyen 2. görevin metnini değiştir |
| `/qm rm 2` | Bekleyen 2. görevi kaldır |
| `/qm undo` | Son kuyruk düzenlemesini geri al |
| `/qm clear` | Yalnızca bekleyen görevleri sil |
| `/qm recover` | Çökme sonrası askıda kalan görevi geri alıp kuyruğu duraklat |
| `/qm help` | Yardımı göster |

## Sınırlar ve dikkat edilmesi gerekenler

Tek seferde en fazla **200 görev**, toplamda en fazla **500 bekleyen görev** eklenebilir. Her görev model kotası ve context tüketebilir; 200K context olsa bile her yeni tur temiz bağlamla başlamaz. Hedefi ve bitiş koşulu belirsizken yüzlerce kez `devam et` göndermek gereksiz işlem üretebilir. Claude'un yanıt vermesi, işin mutlaka başarıyla tamamlandığı anlamına gelmez.

## Sorun giderme

`/qm` görünmüyorsa eklentinin etkin olduğunu kontrol et ve yerel **Code** oturumunu yeniden aç. Aynı anda başka queue eklentisini etkinleştirme. Panel deneysel; önce iki kısa görevle dene. ZIP kurulumu aşağıda.

### ZIP

ZIP arşivini aç, çıkartılan `Claude-Queue-Manager` klasörünü sabit bir konumda tut ve terminalde şunları çalıştır:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Not: Bu sayfa bir çeviri rehberidir; QM panelinin kendisini yerelleştirmez.

0.5.0 doğrulaması: 55 Node testi, 7 resmi Claude host testi geçti. Playwright ile 24 boyut/dil/görev senaryosu ve 6 etkileşim kontrolü geçti. Bu sürümde kurulu Desktop uygulamasında canlı piksel kontrolü yapılmadı; host testleri bileşen protokolünü doğrular. Kısayollar mod yüzeyi odaktayken çalışır; normal mesaj yazarken genel kısayol değildir.

