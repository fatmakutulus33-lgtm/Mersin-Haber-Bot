# 🗞️ Mersin Manşet — Haber Otomasyon Botu

Mersin ve ilçelerindeki yerel haberleri otomatik olarak derleyen, akıllı görsel kartlar oluşturan ve Telegram onay mekanizması üzerinden Instagram'da (Akış ve Hikaye olarak) paylaşan tam otonom bir sistemdir.

Sistem şu anda **Oracle Cloud Infrastructure (OCI) VM** üzerinde **7/24 kesintisiz** olarak çalışmaktadır.

---

## 🚀 Öne Çıkan Özellikler

*   **%100 Görsel Odaklı RSS Derleyici:** Yalnızca görsel içeren öncelikli yerel haber kaynaklarından (Sabah Mersin, NTV) haber çeker. Görselsiz haberler tamamen elenir.
*   **Akıllı Görsel Kart Oluşturucu:** Haber başlığını ve görselini `@napi-rs/canvas` ile harmanlayarak estetik, yüksek çözünürlüklü ve temalı sosyal medya kartları üretir.
*   **Telegram Onay Mekanizması:** Bot her saat başı yeni haber bulduğunda Telegram üzerinden yayıncıya onay butonu (**Yayınla** / **Reddet**) gönderir. Yayıncı onayladığı an Instagram'da paylaşılır.
*   **Çoklu Platform Paylaşımı (Instagram + TikTok + Web + WordPress):** Onaylandığı anda Instagram'a (Akış ve Hikaye), TikTok'a, Mersin Manşet portalına ve WordPress sitesine otomatik olarak gönderilir.
*   **Kalıcı Görsel Saklama:** WordPress ve web portalında kullanılan haber kartları Railway volume alanında korunur; kaynak sitelerin geçici/hotlink görsel adreslerine bağlı kalınmaz.
*   **Premium Kontrol Paneli (Dashboard v6):** Sunucu üzerinde barındırılan modern, şık ve canlı durum takibi sağlayan web arayüzü.

---

## 🛠️ Sistem Mimarisi ve Akış şeması

1.  **Haber Çekme (Fetch):** Sabah ve NTV RSS beslemeleri taranır.
2.  **Filtreleme & Tekilleştirme:** Mersin dışı haberler filtrelenir ve daha önce paylaşılanlar (`posted_news.json`) elenir.
3.  **Kart Tasarımı:** Seçilen haberin görseli indirilerek arka plan yapılır, üzerine yarı şeffaf renk paleti ve başlık eklenerek PNG formatında kart üretilir.
4.  **Telegram Onayı:** Üretilen kart Telegram grubuna butonlarla gönderilir.
5.  **Otomatik Yayınlama:** Onay geldiğinde:
    *   Instagram Graph API ile Feed ve Story olarak paylaşılır.
    *   Zernio API ile TikTok'a paylaşılır.
    *   Mersin Manşet portal API'sine haber eklenir.
    *   WordPress REST API ile belirtilen sitede HTML formatında zengin yayın oluşturulur.

---

## ⚙️ Kurulum ve Ortam Değişkenleri (.env)

Projenin çalışması için kök dizinde bir `.env` dosyası bulunmalıdır:

```env
IG_USER_ID=17841437317502735
IG_ACCESS_TOKEN=<INSTAGRAM_GRAPH_API_TOKEN>
CRON_SCHEDULE=0 * * * *
IMGUR_CLIENT_ID=<IMGUR_CLIENT_ID>
TELEGRAM_BOT_TOKEN=<TELEGRAM_BOT_TOKEN>
TELEGRAM_CHAT_ID=<TELEGRAM_CHAT_ID>

# WordPress Entegrasyonu (Opsiyonel; kapatmak için false)
WORDPRESS_ENABLED=false
WORDPRESS_SITE_URL=https://www.mersinmanset.tr
WORDPRESS_USERNAME=<WORDPRESS_USERNAME>
WORDPRESS_APP_PASSWORD=<WORDPRESS_APP_PASSWORD>
```

---

## 🖥️ Sunucu Yönetimi (Oracle VM & PM2)

Uygulama sunucuda **PM2** süreç yöneticisi altında arka planda çalışmaktadır.

### PM2 Servis Komutları:
*   **Servis Durumu:** `pm2 status`
*   **Canlı Loglar:** `pm2 logs mersin-haber-bot`
*   **Yeniden Başlatma:** `pm2 restart mersin-haber-bot --update-env`
*   **Durdurma:** `pm2 stop mersin-haber-bot`

---

## 🔗 Canlı Arayüz (Dashboard)

Sunucu üzerindeki Express sunucusu doğrudan kontrol panelini sunar.

👉 **Canlı Kontrol Paneli:** [http://84.8.100.227:3000](http://84.8.100.227:3000)
## Railway production

Railway deploy'u `railway.json` içindeki `node index.js` başlangıç komutunu ve
`/health` sağlık kontrolünü kullanır. Kalıcı volume `/data` yoluna bağlanmalı ve
`DATA_DIR=/data` tanımlanmalıdır. Haber geçmişi, ayarlar, bekleyen Telegram onayı,
özel logo ve üretilen görseller bu alanda korunur. `PUBLIC_URL`, Railway servisinin
genel HTTPS adresi olmalıdır.

Kalıcı yayın URL'leri yalnızca `DATA_DIR` ve HTTPS `PUBLIC_URL` birlikte tanımlıysa
Railway `/output` alanını kullanır. Bu dosyalar yayından sonra otomatik silinmez.
