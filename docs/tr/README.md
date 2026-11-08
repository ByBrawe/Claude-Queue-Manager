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
