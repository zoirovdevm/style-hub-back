# Wardrobe.uz — Server bilan ishlash uchun buyruqlar

Bu fayl — kundalik ishlatish uchun tayyor buyruqlar to'plami. Avval serverga kiring:

```bash
ssh root@187.124.68.70
```

Ikkala loyiha shu papkalarda joylashgan:
- Backend: `/var/www/wardrobe-docker/backend`
- Frontend: `/var/www/wardrobe-docker/frontend`

---

## 1) Holatni tekshirish

Ikkalasi ham ishlab turibdimi — shuni ko'rish:

```bash
docker ps
```

Bu barcha ishlab turgan konteynerlarni ko'rsatadi. `wardrobe-backend` va `wardrobe-frontend` "Up" holatida bo'lishi kerak.

Faqat bitta loyiha holatini ko'rish (masalan backend):
```bash
cd /var/www/wardrobe-docker/backend
docker compose ps
```

---

## 2) To'xtatish

**Backend'ni to'xtatish:**
```bash
cd /var/www/wardrobe-docker/backend
docker compose down
```

**Frontend'ni to'xtatish:**
```bash
cd /var/www/wardrobe-docker/frontend
docker compose down
```

**Ikkalasini birdan to'xtatish:**
```bash
cd /var/www/wardrobe-docker/backend && docker compose down
cd /var/www/wardrobe-docker/frontend && docker compose down
```

(`docker compose down` konteynerni butunlay o'chiradi, lekin ma'lumotlar — baza, rasmlar, kod — hech qayerga yo'qolmaydi, chunki ular oddiy papka sifatida diskda turibdi.)

---

## 3) Ishga tushirish

**Backend:**
```bash
cd /var/www/wardrobe-docker/backend
docker compose up -d
```

**Frontend:**
```bash
cd /var/www/wardrobe-docker/frontend
docker compose up -d
```

`-d` — "background'da ishga tushirish" degani (terminalni band qilmaydi).

**Kod o'zgargandan keyin qayta qurib ishga tushirish** (masalan GitHub'dan yangi kod tortib olgandan keyin):
```bash
cd /var/www/wardrobe-docker/backend
git pull
docker compose up -d --build

cd /var/www/wardrobe-docker/frontend
git pull
docker compose up -d --build
```

---

## 4) Qayta ishga tushirish (restart)

Kodni o'zgartirmasdan, shunchaki qayta ishga tushirish kerak bo'lsa (masalan `.env` o'zgartirgandan keyin):

```bash
cd /var/www/wardrobe-docker/backend
docker compose restart backend
```

```bash
cd /var/www/wardrobe-docker/frontend
docker compose restart frontend
```

**Diqqat:** `restart` bu loyihada butun `npm install → build → start` zanjirini qaytadan ishga tushiradi (chunki shu buyruq konteyner ichida yozilgan) — shuning uchun 1-2 daqiqa vaqt oladi, darrov ishlamay qolgandek tuyulishi mumkin. Sabr qiling.

---

## 5) Loglarni ko'rish (nima bo'layotganini kuzatish)

**Jonli oqim (Ctrl+C bilan chiqiladi, konteynerni to'xtatmaydi):**
```bash
cd /var/www/wardrobe-docker/backend
docker compose logs -f
```

**Oxirgi 50 qatorni ko'rish (jonli emas, bir martalik):**
```bash
docker compose logs --tail=50
```

Frontend uchun xuddi shunday, faqat `/var/www/wardrobe-docker/frontend` papkasida.

---

## 6) Konteyner ichiga kirish

Konteyner ichida joylashgan fayllarni ko'rish yoki qo'lda buyruq bajarish uchun:

```bash
docker exec -it wardrobe-backend bash
```

```bash
docker exec -it wardrobe-frontend bash
```

Bu sizni konteyner ichidagi terminalga olib kiradi (`root@<id>:/app#` ko'rinishida). Chiqish uchun `exit` yozing.

**Konteyner ichidan chiqmasdan, bitta buyruq bajarish** (masalan bazadagi mahsulotlar sonini tekshirish uchun GraphQL so'rov yuborish):
```bash
docker exec wardrobe-backend curl -s -X POST http://localhost:4000/graphql -H "Content-Type: application/json" -d '{"query":"{ products(filter: {}) { total } }"}'
```

---

## 7) Nginx bilan ishlash

**Konfiguratsiyani tekshirish (o'zgartirgandan keyin har doim shu):**
```bash
nginx -t
```

**Qayta yuklash** (`nginx -t` xatosiz o'tsa):
```bash
systemctl reload nginx
```

**Konfiguratsiya faylini ko'rish/tahrirlash:**
```bash
nano /etc/nginx/sites-available/wardrobe
```

**Nginx holatini tekshirish:**
```bash
systemctl status nginx
```

---

## 8) SSL sertifikat

**Amal qilish muddatini tekshirish:**
```bash
certbot certificates
```

**Qo'lda yangilash** (odatda avtomatik yangilanadi, lekin tekshirib ko'rish uchun):
```bash
certbot renew --dry-run
```

---

## 9) Disk joyi va resurslar

**Disk joyi qancha qolgani:**
```bash
df -h
```

**Docker qancha joy egallayotgani:**
```bash
docker system df
```

**Ishlatilmayotgan eski Docker rasmlari/keshni tozalash** (joy bo'shatish uchun, ehtiyot bo'lib ishlatish kerak):
```bash
docker system prune -f
```

**Server resurslarini (CPU/RAM) jonli kuzatish:**
```bash
htop
```
(Chiqish: `q`)

---

## 10) Ma'lumotlar bazasi va rasmlarni FileZilla orqali serverga/serverdan ko'chirish

FileZilla'da:
- Host: `sftp://187.124.68.70`
- Foydalanuvchi: `root`
- Port: `22`

**Bazani ko'chirish:**
- Kompyuter: `C:\Users\User\Desktop\fashion-marketplace-backend\prisma\dev.db`
- Server: `/var/www/wardrobe-docker/backend/prisma/dev.db`

**Rasmlarni ko'chirish:**
- Kompyuter: `C:\Users\User\Desktop\fashion-marketplace-backend\uploads`
- Server: `/var/www/wardrobe-docker/backend/uploads`

Bazani almashtirgandan keyin har doim backend'ni qayta ishga tushiring (7-band):
```bash
cd /var/www/wardrobe-docker/backend
docker compose restart backend
```

---

## 11) Tez-tez kerak bo'ladigan to'liq zanjir — "kodni yangiladim, serverga chiqaray"

Kompyuteringizda (loyiha papkasida):
```bash
git add .
git commit -m "o'zgarish tavsifi"
git push
```

Serverda:
```bash
cd /var/www/wardrobe-docker/backend
git pull
docker compose up -d --build

cd /var/www/wardrobe-docker/frontend
git pull
docker compose up -d --build
```

Tekshirish:
```bash
docker compose logs --tail=20
curl -I https://wardrobestore.uz
```
