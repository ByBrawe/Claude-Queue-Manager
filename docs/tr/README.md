# Claude Queue Manager (QM) — Kullanım rehberi

[Proje ana sayfası](../../README.md) · [20 dil seçeneği](../languages/README.md) · [English](../en/README.md) · [MIT](../../LICENSE)

QM, **Claude Desktop → Code** veya **Claude Code CLI** içinde görevleri sıraya alır. Her görevi ayrı bir turda, tek tek başlatır. Native panel, terminal ve yerel web paneli aynı oturumun kuyruğunu yönetir.

## Kurulum

Mods API desteği bulunan yerel bir Claude Code ortamı gerekir. Normal Claude Chat sekmesi, uzak/bulut oturumları ve Desktop WSL oturumları desteklenmez.

Claude Code içinde çalıştır:

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

Yeni bir yerel Code oturumu aç veya `/reload-plugins` çalıştır; ardından `/qm` yaz. Başka bir kuyruk eklentisi kullanıyorsan aynı anda çalıştırma.

Güncellemek için terminalde:

```sh
claude plugin marketplace update claude-queue-manager
claude plugin update qm@claude-queue-manager
```

Aktif görev bittikten sonra açık oturumlarda eklentileri yeniden yükle veya uygulamayı yeniden başlat. QM mevcut Gateway/API bağlantısını kullanır; yapılandırmasını değiştirmez.

### ZIP ile kurulum

Arşivi sabit bir klasöre çıkar ve kök klasörü ekle:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

Kökte `.claude-plugin/marketplace.json` ve `plugins/qm` bulunmalıdır. Native kuyruk için Node.js gerekmez; web paneli ve oturumlar arası geri yükleme için PATH üzerinde **Node.js 20+** gerekir.

## Hızlı başlangıç

Önce duraklatıp listeyi inceleyebilirsin:

```text
/qm pause
/qm batch Projeyi incele || Başarısız testleri düzelt || Derlemeyi çalıştır || Sonucu özetle
/qm
/qm resume
```

Kuyruk duraklatılmamışsa Claude boştayken ilk görev hemen başlayabilir. **Duraklat**, sonraki görevin başlamasını engeller; çalışan turun bitmesine izin verir. Tur kesilir veya host/API hatası oluşursa çalışan görev bekleyenlere döner ve kuyruk duraklar.

## Prompt üstündeki tam panel

`/qm`, `/qm inline` veya özet çubuğundaki **Genişlet**, tam paneli prompt yazma alanının üstünde açar. Şu kontroller birlikte görünür:

- Dil, Duraklat/Devam, Geri al, Bekleyenleri sil ve Web.
- Çok satırlı görev girişi ve Kuyruğa ekle.
- Ayrı **Adet + Mesaj + Tekrarla** alanı.
- Bekleyen görevlerde arama, seçim, düzenleme, taşıma ve onaylı silme.

**Ayrıntılar**, düzenlenebilir gelişmiş ayarlar ile bağlam, geçmiş, istatistikler ve oturum bilgilerini açıp kapatır. Temel kuyruk kontrollerini gizlemez. **Yan panel** ayrı native paneli açar; konumunu ve boyutunu Claude host belirler. **Web**, tarayıcıyı açar. **Kapat**, tam paneli kapatır; bekleyen veya çalışan iş varsa özet çubuğu kalır.

Prompt üstünde sayfa başına **4**, yan panelde **12** görev gösterilir. Çalışan görev yeşil, duraklatılmış kuyruk sarıdır; durum metinle de belirtilir. Tab/Shift+Tab ile odaklanıp Enter ile seçebilirsin. `p` ve `q` kısayolları mod yüzeyi odaktayken çalışır; normal prompt yazarken uygulanmaz.

Bekleyen sıra yukarıdan aşağıya **1 → 2 → 3** şeklindedir. **Sıradaki bekleyen** özeti, arama veya başka bir sayfa açıkken bile tüm kuyruğun ilk bekleyen görevini gösterir. **İlk görevi göster**, filtreyi temizleyip ilk sayfaya döner. Koşulu sağlanmayan görevler atlanabilir. Numaralar kalıcı görev kimliği değil, bekleyen sıradaki konumdur.

Düzenleyici panelin üst kısmında tam genişlikte açılır: yan panelde **10**, prompt üstünde **6 satır**. Uzun ve çok satırlı metni **Değişikliği kaydet** düğmesiyle uygula; giriş alanının gönderme işlemi tek başına kaydetmez.

## 5 veya 20 tekrar ekleme

**Adet** alanına 5 ya da 20, **Mesaj** alanına gönderilecek görevi yaz ve **Tekrarla** düğmesine bas. Aynı işlemin komut karşılığı:

```text
/qm repeat 5 Sıradaki tamamlanmamış işe devam et
/qm repeat 20 Kararlaştırılan planın sonraki adımını uygula
```

`devam et` özel bir QM komutu değildir; Claude'a gönderilecek normal mesajdır. Tek seferde 1–200 tekrar eklenebilir. Her tekrar ayrı görevdir; model kotası ve oturum bağlamı tüketir. Farklı görevler için her satıra bir görev yaz veya `||` ile ayır.

## 20 dil seçeneği

[20 dilin tamamı ve kodları](../languages/README.md) hem rehber hem arayüz seçeneği olarak bulunur. Native panelin üstündeki dil menüsünü veya şu komutları kullan:

```text
/qm lang tr
/qm lang en
/qm lang de
/qm lang pt-BR
/qm lang zh-CN
```

Native/CLI tercihi yeniden başlatmada korunur. Web panelinin kendi dil menüsü ve tarayıcıda saklanan tercihi vardır. İlk kullanım dili Türkçedir; kaydedilmiş tercih korunur. Arapça ve Farsça web görünümünde sağdan sola düzen kullanır. Komut adları, görev metinleri ve host kaynaklı tanılama mesajları çevrilmez.

## Yerel web paneli

`/qm web`, `127.0.0.1` üzerinde yerel sunucu açar, tarayıcıyı başlatmayı dener ve pano erişilebiliyorsa özel bağlantıyı kopyalar. Sayfayı kapatırsan aynı komutla yeniden açabilirsin. `/qm web stop` sunucuyu kapatır.

- Sürükleme tutamacıyla yalnızca bekleyen görevleri sırala; seçili grubu birlikte taşı.
- Çoklu seçimle üste/alta taşı veya onaylayarak sil.
- Sürüklemeden önce arama filtresini temizle.
- Bağlantı kesilirse taslak korunur ve yeniden bağlanma denenir. Başarı mesajı yalnızca mod işlemi kaydettikten sonra gösterilir.
- Eşzamanlı değişiklikte eski bir düzenleme yanlış göreve uygulanmak yerine reddedilir.

Web ve Desktop aynı oturumun kuyruğunu gösterir. Bağlantıdaki token özeldir; paylaşma. Panel ayrı bir bulut servisine bağlanmaz. Bağlantı sorunu kalırsa aynı oturumda `/qm web stop`, ardından `/qm web` çalıştır.

## Gelişmiş ayarlar

Native/CLI panelinde **Ayrıntılar**, web panelinde **Gelişmiş ayarlar** bölümünü aç. Mevcut yedi ayar komut yazmadan değiştirilebilir:

| Ayar | Değer |
| --- | --- |
| Doğrulama | Kapalı, Marker veya AI |
| AI doğrulama modeli | Yalnızca AI doğrulamasında kullanılan mevcut model adı/takma adı |
| Yeniden deneme | 0–5 ek deneme |
| Denemeler arası süre | 0–600 saniye |
| Zaman aşımı | 0–86.400 saniye; 0 kapatır |
| Bağlam eşiği | %0–99; 0 kapatır |
| Başarısızlıkta | Duraklat veya devam et |

**Ayarları kaydet**, formun tamamını doğrulayıp tek işlemde kaydeder. **Kayıtlı ayarları yükle**, taslağı bırakıp güncel kaydı getirir. **Varsayılana sıfırla**, varsayılan ayarları doğrudan kaydeder: doğrulama kapalı, doğrulama modeli haiku, retry/bekleme/zaman aşımı/bağlam eşiği 0 ve başarısızlıkta duraklat. Sıfırlama dili, görevleri, geçmişi ve duraklatma durumunu korur; kuyruğu devam ettirmez. Hatalarda taslak korunur; başka panel veya komuttan değiştirilmiş ayarların üstüne sessizce yazılmaz. Kaydetmek kuyruğu devam ettirmez. Çalışan kuyruk görevi varken kayıt engellenir; önce duraklatıp görevin bitmesini bekle.

**Son başarısız görevi kuyruğa al**, son başarısız/zaman aşımı/belirsiz görevi başa ekler ve inceleme için kuyruğu duraklatır. Retry yalnızca başarısız doğrulama veya zaman aşımında uygulanır; API hataları ve kesintiler kuyruğu duraklatır. AI doğrulaması ek model çağrısı kullanır; zaman aşımı tur bittikten sonra değerlendirilir. Gateway/API yapılandırması değişmez.

## Claude kendi listesini oluşturabilir

QM, resmi **`mcp__qm__queue`** aracını kaydeder. Örnek istek:

> Proje için inceleme, düzeltme, test ve özet görevlerinden bir kuyruk oluştur. Önce duraklat; listeyi inceleyeyim.

Claude kuyruğu listeleyebilir, görev ekleyebilir, bekleyen kimlikleri sıralayıp silebilir ve duraklatıp devam ettirebilir. Çalışan görev değiştirilemez. Yeniden sıralama tüm bekleyen kimliklerini birer kez içermelidir. Host araç izinleri geçerlidir.

Normal `/qm` komut argümanları modelin okuyacağı komut kaydından çıkarılır. Claude'dan kuyruğu aracıyla yönetmesini istediğinde bekleyen görev metinlerini okuyabilir. Kuyruğun içine tekrar kuyruk yönetimi yaptıran döngüsel görevler ekleme.

## Komut rehberi

| Komut | İşlev |
| --- | --- |
| `/qm`, `/qm inline`, `/qm list` | Prompt üstünde yöneticiyi aç |
| `/qm side`, `/qm close` | Yan paneli aç / yöneticiyi kapat |
| `/qm add <görev>`, `/qm front <görev>` | Sona / başa görev ekle |
| `/qm batch A \|\| B \|\| C` | Farklı görevleri sırayla ekle |
| `/qm repeat 5 <mesaj>` | Aynı mesajı 5 kez ekle |
| `/qm pause`, `/qm resume` | Sonraki görevi beklet / devam ettir |
| `/qm edit 2 <metin>`, `/qm rm 2`, `/qm mv 3 1` | Bekleyen görev düzenle, sil, taşı |
| `/qm clear`, `/qm undo` | Bekleyenleri sil / kuyruk düzenlemesini geri al |
| `/qm lang tr` | Arayüz dilini seç |
| `/qm web`, `/qm web stop` | Web panelini aç veya yeniden aç / sunucuyu durdur |
| `/qm verify off\|marker\|ai [haiku]` | Doğrulamayı seç; AI ek model çağrısı kullanır |
| `/qm retry 2 5s`, `/qm retry last` | Sınırlı tekrar denemesini ayarla / son başarısız veya belirsiz görevi ekle |
| `/qm timeout 10m\|off` | Tur bittikten sonra süreyi değerlendir; turu zorla kesmez |
| `/qm context`, `/qm context 85\|off` | Host bağlam verisini oku / başlatma eşiği ayarla |
| `/qm if success <görev>`, `/qm if failure <görev>` | Koşullu görev ekle |
| `/qm onfail pause\|continue` | Başarısızlıkta duraklat / devam et |
| `/qm history [1-50]`, `/qm stats`, `/qm settings` | Geçmiş, istatistik ve ayarları göster |
| `/qm sessions`, `/qm restore SESSION_ID [recover]` | Oturumları listele / duraklatılmış kuyruğu boş oturuma aktar |
| `/qm recover` | Askıda kalmış görevi geri al ve duraklat |
| `/qm help` | Yardımı göster |

## Yeniden başlatmadan sonra kurtarma

PC veya Code oturumu yarım kalan görevle yeniden açılırsa **Kurtarma bekliyor** görünür. Askıdaki görev aktif sayıdan ayrı gösterilir. Panelin üstündeki **Görevi kuyruğa geri al**, görevi bekleyenlerin başına koyar; otomatik çalıştırmaz. Listeyi inceleyip ardından **Devam ettir** seç. Web panelinde de aynı işlem vardır.

Kurtarma, kapanmadan önce yapılmış işleri tekrarlayabilir. Claude’un izlenen canlı turu sürüyorsa önce bitmesi beklenir. Komut karşılığı inceleme sonrasında `/qm recover` ve ardından `/qm resume` işlemleridir.

## Sınırlar ve davranış

En fazla **200 görev/ekleme**, **500 bekleyen görev**, görev başına **20.000 karakter** desteklenir. Kuyruk kayıt bütçesi **2.800 KiB**, hostun paylaşılan eklenti depolaması **4 MiB**'dır. Sığmayan ekleme mevcut bekleyen/çalışan işi silmeden reddedilir.

Turun bitmesi görevin başarıyla tamamlandığını kanıtlamaz. Marker doğrulaması modelin kendi bildirimidir; AI doğrulaması son yanıtı inceler ve belirsiz sonuç verebilir. Belirsiz sonuç otomatik tekrarlamak yerine duraklatır. Tekrar deneme aynı yan etkileri yeniden çalıştırabilir.

Bağlam değerleri resmi host kullanım verisinden alınır; erişilemiyorsa sahte değer üretilmez. Son kaydedilmiş okuma görünebilir. Bağlam eşiği oturumu kendiliğinden temizlemez veya sıkıştırmaz.

Oturum kurtarmada görevin daha önce tamamlanıp tamamlanmadığını kontrol et. Oturumlar arası aktarım için kaynak duraklatılmış, hedef boş olmalı; kaynak oturumu kapat. `recover` seçeneği olası tekrar çalıştırmayı açıkça kabul eder. QM, Claude'un Ctrl+Enter kuyruğunu değiştirmez.

[Ayrıntılı otomasyon rehberi](FEATURES-0.4.md) · [Sürüm geçmişi](../../CHANGELOG.md)

## Geliştirme ve doğrulama

```sh
npm run verify
npm run validate:mod
npm run test:host
```

Resmi host testleri dar ve geniş terminal/Desktop eleman protokolünü doğrular; kurulu Desktop uygulamasının son piksel görünümünü doğrulamaz. İsteğe bağlı Playwright kontrolü için ayrı bir QA ortamında `node scripts/ui-smoke.mjs` çalıştırılabilir. Gerekirse `QM_PLAYWRIGHT_MODULE` tanımlanır; görseller `artifacts/` altına yazılır.

## Lisans

[MIT](../../LICENSE) · © 2026 ByBrawe.

