# انتشار پنل مکادیز روی GitHub — راهنمای گام‌به‌گام

پنل یک اپلیکیشن **HTML/CSS/JS خالص** است؛ هیچ بک‌اند، دیتابیس یا build step ندارد.
پس روی **GitHub Pages** (رایگان) مستقیم بالا می‌آید و آدرسی دائمی می‌گیرد.

نتیجهٔ نهایی:

```
https://USERNAME.github.io/mecades-admin/
```

> فایل‌های لازم برای انتشار:
> ```
> index.html                ← نقطهٔ شروع
> assets/                   ← css، js، فونت وزیرمتن، لوگو
> mecades-admin.html        ← (اختیاری) نسخهٔ تک‌فایلی
> google-apps-script/       ← (اختیاری) کد بکاپ شیت
> README.md
> DEPLOY-GITHUB.md
> ```

---

## روش ۱ — بدون نصب هیچ برنامه‌ای (مرورگر، ساده‌ترین)

1. وارد [github.com](https://github.com) شوید → دکمهٔ **+** (بالا راست) → **New repository**.
2. تنظیمات:
   - **Repository name**: `mecades-admin`
   - **Visibility**: **Public** ← لازم است (Pages در حساب رایگان فقط روی ریپوی عمومی کار می‌کند)
   - تیک **Add a README file** را **نزنید** (خودمان README داریم)
   - **Create repository**
3. در صفحهٔ ریپوی خالی → **uploading an existing file**.
4. فایل `mecades-admin-github.zip` را از حالت فشرده خارج کنید و **محتویات پوشه** را
   (نه خودِ پوشه) داخل صفحهٔ آپلود **drag & drop** کنید:
   `index.html` + پوشهٔ `assets` + بقیهٔ فایل‌ها.
   > مهم: باید `index.html` در **ریشهٔ** ریپو باشد، نه داخل یک پوشهٔ اضافه.
   > ساختار درست: `mecades-admin/index.html` و `mecades-admin/assets/...` (در ریپو، نه روی دیسک شما).
5. پایین صفحه → **Commit changes**.
6. **Settings** (بالای ریپو) → منوی چپ **Pages**.
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` ، پوشه: **`/ (root)`** → **Save**
7. ۱ تا ۲ دقیقه صبر کنید و صفحه را رفرش کنید؛ بالای همان صفحه آدرس ظاهر می‌شود:
   ```
   https://USERNAME.github.io/mecades-admin/
   ```

---

## روش ۲ — با Git (خط فرمان)

```bash
# ۱) داخل پوشهٔ پروژه
cd mecades-admin

# ۲) ریپوی محلی
git init
git add .
git commit -m "MECADES Admin Panel v1.0.N"

# ۳) اتصال به ریپوی GitHub (که در سایت ساختهاید)
git branch -M main
git remote add origin https://github.com/USERNAME/mecades-admin.git
git push -u origin main
```

**احراز هویت:** گیت‌هاب از سال ۲۰۲۱ رمز عبور را قبول نمی‌کند.
از **Personal Access Token** استفاده کنید:

1. GitHub → **Settings** (حساب، نه ریپو) → **Developer settings** →
   **Personal access tokens** → **Tokens (classic)** → **Generate new token**
2. Scope: فقط **`repo`** کافی است → Generate → توکن را کپی کنید (فقط یک بار نشان داده می‌شود).
3. موقع `git push`:
   - `Username`: نام‌کاربری گیت‌هاب
   - `Password`: همان **توکن** (نه رمز عبور)

یا ساده‌تر: [GitHub CLI](https://cli.github.com) را نصب کنید و `gh auth login` بزنید.

سپس مثل روش ۱، **Settings ← Pages ← Branch: main / root ← Save**.

---

## روش ۳ — GitHub Desktop

1. [desktop.github.com](https://desktop.github.com) را نصب کنید.
2. **File ← Add local repository** → پوشهٔ `mecades-admin` را انتخاب کنید.
3. **Publish repository** → تیک **Keep this code private** را بردارید (برای Pages عمومی لازم است).
4. در سایت ریپو: **Settings ← Pages ← main / root ← Save**.

---

## بعد از انتشار — چک‌لیست

- [ ] آدرس Pages باز می‌شود و صفحهٔ ورود می‌آید.
- [ ] لاگین/ساخت حساب مدیر کار می‌کند (روی همان مرورگر).
- [ ] لوگو و فونت وزیرمتن لود می‌شوند (یعنی مسیر `assets/` درست است).
- [ ] در موبایل هم صفحه اسکرول افقی ندارد.
- [ ] **امنیت شیت:** در شیت، منوی **«بکاپ مکادیز ← درباره»** را باز کنید تا **توکن** ساخته شود؛
      توکن را در پنل ← تنظیمات ← «همگام‌سازی Google Sheets» بگذارید.
      بدون توکن، هر کسی که آدرس `/exec` را داشته باشد می‌تواند داده‌های شیت را بازنویسی کند.
- [ ] اگر می‌خواهید داده‌ها فقط روی گوشی/کامپیوتر خودتان بماند: ریپو را **Private** کنید
      (در حساب رایگان Pages برای ریپوی خصوصی فعال نیست؛ در این حالت از Cloudflare Pages یا Netlify استفاده کنید).

---

## آدرس دلخواه / دامنهٔ شخصی

- تغییر نام ریپو = تغییر آدرس: `https://USERNAME.github.io/NEWNAME/`
- دامنهٔ اختصاصی: **Settings ← Pages ← Custom domain** → مثلاً `panel.mecades.ir`
  و در DNS یک رکورد `CNAME` به `USERNAME.github.io` بسازید.

---

## به‌روزرسانی نسخه بعدی

**مرورگر:** در ریپو → **Add file ← Upload files** → فایل‌های عوض‌شده (مثلاً `assets/js/app.js`) را
بکشید و **Commit** کنید. گیت‌هاب فایل قبلی را جایگزین می‌کند.

**Git:**

```bash
git add .
git commit -m "v1.0.N — تغییرات"
git push
```

انتشار ۳۰ تا ۹۰ ثانیه طول می‌کشد. حتماً **Ctrl+Shift+R** بزنید (کش مرورگر).

---

## نکته‌های مهم دربارهٔ داده‌ها

| موضوع | توضیح |
|---|---|
| داده کجا ذخیره می‌شود؟ | در **localStorage همان مرورگر** — هیچ داده‌ای روی GitHub نمی‌رود. |
| انتقال بین دستگاه‌ها | با «کد پشتیبان (Google Docs)» یا «ارسال به Google Sheets». |
| پاک کردن کش مرورگر | داده‌های پنل هم پاک می‌شوند؛ قبلش بکاپ بگیرید. |
| ریپو عمومی | فقط **کد** دیده می‌شود، نه سفارش‌ها و مشتری‌ها. ولی آدرس Web App شیت داخل کد است → توکن بسازید. |
| نسخهٔ تک‌فایلی | `mecades-admin.html` را هم می‌توانید آپلود کنید و مستقیم با آدرس `https://USERNAME.github.io/mecades-admin/mecades-admin.html` باز کنید. |

---

## عیب‌یابی

| نشانه | علت / راه‌حل |
|---|---|
| صفحهٔ 404 | `index.html` در ریشه نیست (داخل یک زیرپوشه است) → فایل‌ها را در ریشهٔ ریپو بگذارید. |
| بدون استایل (سفید) | پوشهٔ `assets` آپلود نشده یا مسیرش عوض شده؛ ساختار پوشه‌ها باید حفظ شود. |
| لوگو لود نمی‌شود | فایل `assets/img/mecades-logo.png` را چک کنید (حساس به بزرگی/کوچکی حروف است). |
| تغییرات دیده نمی‌شود | کش مرورگر → **Ctrl+Shift+R**؛ یا در تب Actions ببینید آخرین deploy تمام شده است. |
| «Pages isn't available» | ریپو Private است → Public کنید یا از Netlify/Cloudflare Pages استفاده کنید. |
| منوی شیت کار نمی‌کند | اسکریپت را در Apps Script ذخیره و شیت را Refresh کنید. |
