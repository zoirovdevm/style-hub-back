# Wardrobe.uz — Docker + GitHub orqali serverga chiqarish

Bu yo'riqnoma sizning tayyor serveringiz (`187.124.68.70`) va domeningiz
(`wardrobe.uz`) uchun. `server-setup.sh` (PM2 asosida) o'rniga endi
Docker ishlatiladi — yangilanish endi shunchaki `git pull` + bitta
buyruq bilan bo'ladi.

Eslatma: serverda allaqachon boshqa loyihangiz 4000/4001/4002 portlarda
ishlab turibdi — quyida tanlangan portlar (5100/5101) ular bilan
to'qnashmaydi. Baribir birinchi safar tekshirib ko'ring:

```bash
ss -tlnp | grep -E ':5100|:5101'
```

Agar bo'sh chiqsa (hech narsa qaytmasa) — davom eting. Band bo'lib
qolsa, quyidagi `.env` / `.env.production` fayllaridagi
`BACKEND_PORT`/`FRONTEND_PORT` qiymatlarini boshqasiga almashtiring.

---

## 1) Bir martalik: kodni GitHub'ga qo'yish

Har ikkala loyihada `.git` papkasi allaqachon bor, faqat remote
qo'shilmagan bo'lishi mumkin. Har bir loyiha papkasida (frontend va
backend uchun alohida-alohida):

```bash
git remote -v          # remote borligini tekshirish
```

Agar bo'sh chiqsa (remote yo'q) — GitHub'da ikkita bo'sh repo yarating
(masalan `wardrobe-backend`, `wardrobe-frontend`), keyin:

```bash
git remote add origin https://github.com/<username>/wardrobe-backend.git
git branch -M main
git push -u origin main
```

Xuddi shuni frontend papkasida ham, faqat `wardrobe-frontend.git` bilan.

**MUHIM — push qilishdan oldin tekshiring:**

```bash
git status
```

`server-setup.sh` va `data-export.json` fayllari `.gitignore`'da bor —
`git status` ularni "tracked" deb ko'rsatmasligi kerak. Agar
ko'rsatilsa (masalan ilgari `.gitignore` yozilishidan oldin bir marta
commit qilingan bo'lsa), avval bularni repo tarixidan butunlay
tozalash kerak (bu haqiqiy parollar/tokenlar o'z ichiga oladi) — bunday
holat topilsa, keyingi qadamga o'tishdan oldin menga ayting, birga
tozalaymiz.

---

## 2) Bir martalik: serverga Docker o'rnatish

Serverga SSH orqali kiring, so'ng:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version
docker compose version
```

Ikkala loyiha bir-biriga to'g'ridan-to'g'ri (Nginx'siz) murojaat qila
olishi uchun umumiy Docker tarmog'ini yarating (faqat bir marta):

```bash
docker network create wardrobe-net
```

---

## 3) Bir martalik: loyihalarni serverga klonlash

```bash
mkdir -p /var/www/wardrobe-docker
cd /var/www/wardrobe-docker
git clone https://github.com/<username>/wardrobe-backend.git backend
git clone https://github.com/<username>/wardrobe-frontend.git frontend
```

### Backend `.env` yaratish

`backend/.env` faylini qo'lda yarating (bu git'ga tushmaydi):

```bash
cd /var/www/wardrobe-docker/backend
nano .env
```

Quyidagini joylashtiring — **JWT_ACCESS_SECRET va JWT_REFRESH_SECRET'ni
albatta yangi tasodifiy qiymatlar bilan almashtiring** (pastda buyrug'i
bor), qolganini o'zingizning hozirgi mahalliy `.env`'ingizdagi haqiqiy
qiymatlar bilan to'ldiring (SMTP_PASS, TELEGRAM_BOT_TOKEN va h.k. — bu
sirlarni bu yerga menga yubormang, to'g'ridan-to'g'ri serverga o'zingiz
kiriting):

```bash
DATABASE_URL="file:./dev.db"

PORT=4000
CORS_ORIGIN="https://wardrobe.uz,https://www.wardrobe.uz"

JWT_ACCESS_SECRET="<openssl rand -hex 32 natijasi>"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="<openssl rand -hex 32 natijasi>"
JWT_REFRESH_EXPIRES_IN="7d"

CLICK_SERVICE_ID=""
CLICK_MERCHANT_ID=""
CLICK_SECRET_KEY=""
CLICK_TEST_MODE="true"

PAYME_MERCHANT_ID=""
PAYME_SECRET_KEY=""
PAYME_TEST_MODE="true"

SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASS="<hozirgi .env'dagi qiymat>"
MAIL_FROM="Wardrobe <onboarding@resend.dev>"

TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_FROM=""

TELEGRAM_BOT_TOKEN="<hozirgi .env'dagi qiymat>"
TELEGRAM_ADMIN_CHAT_ID="<hozirgi .env'dagi qiymat>"
TELEGRAM_BOT_USERNAME="StyleHubCheckBot"
TELEGRAM_STOCK_BOT_TOKEN="<hozirgi .env'dagi qiymat>"

# O'z telefoningizdan SMS Gateway — bu FAQAT sizning
# kompyuteringiz/telefoningiz bir xil mahalliy tarmoqda bo'lganda
# ishlaydi. Server sizning kompyuteringiz bilan bir tarmoqda emas,
# shuning uchun bu ishlamaydi — bo'sh qoldiring, backend avtomatik
# ravishda kodni konsolga chiqaradi (yoki quyida Eskiz/Twilio'ni
# sozlang, agar haqiqiy SMS serverdan ham ketishi kerak bo'lsa).
SMS_GATEWAY_BASE_URL=""
SMS_GATEWAY_USERNAME=""
SMS_GATEWAY_PASSWORD=""

# Ixtiyoriy: portni o'zgartirish kerak bo'lsa (standart: 5101)
# BACKEND_PORT=5101
```

Tasodifiy JWT sirlarini generatsiya qilish:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

**Diqqat — SMS haqida:** hozirgi kod (`sms.service.ts`) avval o'zingizning
kompyuteringizdagi SMS Gateway'ga murojaat qiladi. Server sizning
kompyuteringiz/telefoningiz bilan bir xil mahalliy tarmoqda bo'lmagani
uchun, bu serverdan ishlamaydi. Ya'ni serverga chiqargandan keyin
ro'yxatdan o'tish/parolni tiklash SMS kodlari **konsolga
chiqadi**, foydalanuvchiga haqiqatan yetib bormaydi — buni istasangiz,
Eskiz.uz yoki Twilio kabi haqiqiy A2P SMS xizmatiga ulanish kerak
bo'ladi (bu alohida masala, xohlasangiz shuni ham sozlab beraman).

### Frontend `.env.production` yaratish

```bash
cd /var/www/wardrobe-docker/frontend
nano .env.production
```

```bash
NEXT_PUBLIC_GRAPHQL_URL=""
NEXT_PUBLIC_API_URL=""
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="StyleHubCheckBot"
GRAPHQL_INTERNAL_URL="http://wardrobe-backend:4000/graphql"

# Ixtiyoriy: portni o'zgartirish kerak bo'lsa (standart: 5100)
# FRONTEND_PORT=5100
```

(`NEXT_PUBLIC_GRAPHQL_URL` ataylab bo'sh — brauzer nisbiy `/graphql`
manzilidan foydalanadi, buni Nginx to'g'ridan-to'g'ri backend'ga
yo'naltiradi. `GRAPHQL_INTERNAL_URL` esa faqat server-tomonlama
(SSR) so'rovlar uchun — Docker tarmog'i orqali backend konteyneriga
to'g'ridan-to'g'ri boradi, Nginx'ni chetlab o'tib.)

### Eski ma'lumotlar bazasini ko'chirish (ixtiyoriy)

Agar mahalliy kompyuteringizdagi hozirgi foydalanuvchilar/mahsulotlar
bilan boshlashni istasangiz, `prisma/dev.db` faylingizni serverga
nusxalang (masalan `scp` orqali) — `backend/prisma/dev.db` joyiga,
birinchi `docker compose up` dan OLDIN. Aks holda birinchi ishga
tushirishda bo'sh (yangi) baza yaratiladi.

---

## 4) Birinchi marta ishga tushirish

```bash
cd /var/www/wardrobe-docker/backend
docker compose up -d --build

cd /var/www/wardrobe-docker/frontend
docker compose up -d --build
```

Holatni tekshirish:

```bash
docker compose logs -f      # har bir papkada alohida
```

Birinchi ishga tushirishda `npm install` + build bir necha daqiqa
vaqt olishi mumkin — loglar orqali kuzatib turing.

---

## 5) Nginx'ni yangi portlarga yo'naltirish

Serveringizda Nginx (`server-setup.sh` orqali) allaqachon o'rnatilgan
bo'lishi mumkin. `/etc/nginx/sites-available/wardrobe` faylini oching:

```bash
nano /etc/nginx/sites-available/wardrobe
```

Fayl ichidagi **barcha** `proxy_pass http://127.0.0.1:<eski_backend_port>`
qatorlarini `http://127.0.0.1:5101` ga, va
`proxy_pass http://127.0.0.1:<eski_frontend_port>` qatorini
`http://127.0.0.1:5100` ga almashtiring (agar SSL bloki ham bo'lsa —
certbot uni avtomatik ikkinchi `server {}` blok qilib qo'shgan bo'ladi,
o'sha yerdagi portlarni ham xuddi shunday almashtiring).

Agar bu fayl umuman mavjud bo'lmasa (hali server-setup.sh
ishlatilmagan bo'lsa), quyidagini yarating:

```nginx
server {
    listen 80;
    server_name wardrobe.uz www.wardrobe.uz;

    client_max_body_size 25m;

    location /graphql {
        proxy_pass http://127.0.0.1:5101;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:5101;
        proxy_set_header Host $host;
    }
    location /upload/ {
        proxy_pass http://127.0.0.1:5101;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /presence/ {
        proxy_pass http://127.0.0.1:5101;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    location /ws/ {
        proxy_pass http://127.0.0.1:5101;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
    location / {
        proxy_pass http://127.0.0.1:5100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**MUHIM — real IP forwarding haqida (performance/rate-limit debug natijasida qo'shildi):**
`X-Forwarded-For $proxy_add_x_forwarded_for` qatorlari `/graphql` va
`/presence/` bloklariga ataylab qo'shildi — bu backend'dagi
`app.set('trust proxy', 1)` (src/main.ts) bilan birga ishlaydi. Buning
sababi: bu ikkalasi bo'lmasa, Express har doim so'rovni Nginx'ning o'zidan
(127.0.0.1) kelayotgandek ko'radi — ya'ni butun dunyodagi BARCHA
tashrifchilar bitta "IP" sifatida hisoblanadi, va `ThrottlerModule`dagi
IP-bo'yicha limit aslida SAYT BO'YICHA UMUMIY limitga aylanib qoladi
(bir foydalanuvchi emas, hammaning yig'indisi). Bu sinab ko'rilganda
production'da atigi ~30 ta GraphQL so'rovdan keyin (bir necha soniyada)
`ThrottlerException: Too Many Requests` xatosi chiqishi tasdiqlangan —
bu esa SSR sahifalarning tasodifiy vaqtlarda umuman ochilmay qolishiga
(serverFetchGraphQL xato bo'lsa throw qiladi) sabab bo'lgan asosiy
muammolardan biri edi.

Agar serverdagi joriy `/etc/nginx/sites-available/wardrobe` fayli yuqoridagi
shablondan oldinroq yaratilgan bo'lsa (ya'ni `X-Forwarded-For` qatori yo'q),
uni qo'lda qo'shib, keyin tekshirib qayta yuklash kerak:
```bash
nano /etc/nginx/sites-available/wardrobe
# /graphql va /presence/ bloklariga:
#   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
nginx -t && systemctl reload nginx
```
Backend tomonidagi `trust proxy` o'zgarishi kuchga kirishi uchun
`docker compose up -d --build` bilan backend qayta qurilishi kerak (oddiy
`restart` yetarli emas — kod o'zgargan, image emas, bind-mount orqali kod
konteynerga tushadi, lekin Node jarayoni qayta ishga tushishi kerak; shu
sababli eng ishonchli yo'l — pastdagi "6-band"dagi git pull + rebuild
zanjiri).

```bash
ln -sf /etc/nginx/sites-available/wardrobe /etc/nginx/sites-enabled/wardrobe
nginx -t && systemctl reload nginx
```

SSL hali yo'q bo'lsa:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d wardrobe.uz -d www.wardrobe.uz --redirect
```

(Agar avval PM2 orqali SSL allaqachon o'rnatilgan bo'lsa, bu qadamni
qayta bajarish shart emas — sertifikat allaqachon bor va Docker'ga
ko'chirilgandan keyin ham ishlayveradi, chunki Nginx serverning o'zida
qoladi, faqat orqadagi portlar o'zgardi.)

---

## 6) Keyingi yangilanishlar (har safar shunchaki shu)

```bash
cd /var/www/wardrobe-docker/backend
git pull
docker compose up -d --build

cd /var/www/wardrobe-docker/frontend
git pull
docker compose up -d --build
```

`prisma/dev.db` va `uploads/` papkasi bind mount orqali serverdagi
papkada to'g'ridan-to'g'ri turadi — `git pull` ularga tegmaydi (ular
`.gitignore`'da), shuning uchun har bir yangilanishda ma'lumotlar
o'chib ketmaydi.

---

## Foydali buyruqlar

```bash
docker compose ps                 # ishlab turgan konteynerlar
docker compose logs -f backend    # backend loglari (jonli)
docker compose logs -f frontend   # frontend loglari (jonli)
docker compose restart backend    # faqat qayta ishga tushirish (build'siz)
docker compose down               # to'xtatish
```
