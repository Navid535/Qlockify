# Quera Clock
<div dir="rtl">
Quera Clock یک ابزار مدیریت زمان و فعالیت‌های کاری است که در قالب یک پروژه‌ی آموزشی Django توسعه داده شده است. هدف پروژه، پیاده‌سازی یک بک‌اند قابل استفاده برای مدیریت ورک‌اسپیس، اعضا، مشتری‌ها، پروژه‌ها، برچسب‌ها و ثبت زمان فعالیت‌ها است.

این پروژه در ابتدا به‌صورت یک وب‌سایت Django توسعه داده شد و در ادامه به یک بک‌اند مبتنی بر REST API تبدیل شد تا بتواند با یک فرانت‌اند جداگانه ارتباط برقرار کند.

## قابلیت‌ها

* احراز هویت کاربران و مدیریت پروفایل
* مدیریت Workspace و اعضای آن
* سیستم نقش‌ها و سطح دسترسی کاربران
* مدیریت مشتری‌ها، پروژه‌ها و برچسب‌ها
* ثبت، ویرایش و حذف نرم زمان‌های کاری
* شروع و توقف تایمر
* ثبت زمان دستی
* فیلتر و جست‌وجوی Time Entryها
* گروه‌بندی تایم‌شیت بر اساس روز
* Pagination
* محدودسازی درخواست‌ها (Throttling)
* سیستم اعلان‌ها
* ارسال اعلان‌های زنده با SSE
* وظایف پس‌زمینه با Celery
* سیستم Cache و Cache Invalidation
* پنل مدیریت Django
* Soft Delete برای داده‌های اصلی

## معماری پروژه

ساختار پروژه بر اساس تفکیک دامنه‌های اصلی طراحی شده است:
</div>

```text
apps/
├── clients/
├── contact_notes/
├── notifications/
├── projects/
├── tags/
├── time_entries/
├── users/
└── workspaces/

config/
├── settings/
│   ├── base.py
│   ├── development.py
│   └── test.py
├── celery.py
├── asgi.py
└── wsgi.py

core/
├── admins/
├── models/
├── cache.py
└── pagination.py
```
<div dir="rtl">

هر دامنه‌ی اصلی API، serializer، view و تست‌های مربوط به خود را دارد و قابلیت‌های مشترک در `core` قرار گرفته‌اند.

## تکنولوژی‌ها

* Python
* Django
* Django REST Framework
* Celery
* JWT Authentication
* SQLite در محیط توسعه
* Server-Sent Events (SSE)
* Django Cache Framework


## اجرای پروژه
ابتدا وابستگی‌ها را نصب کنید:
</div>

```bash
pip install -r requirements.txt
```
<div dir="rtl">
سپس migrationها را اجرا کنید:
</div>

```bash
python manage.py migrate
```
<div dir="rtl">
برای اجرای سرور توسعه:
</div>

```bash
python manage.py runserver
```
<div dir="rtl">
پس از اجرا، پروژه از طریق آدرس زیر در دسترس خواهد بود:
</div>

```
http://127.0.0.1:8000/
```
<div dir="rtl">

## تست‌ها
برای اجرای تست‌های پروژه:
</div>

```bash
python manage.py test
```
<div dir="rtl">
تست‌های مربوط به هر دامنه در پوشه‌ی `checks` همان اپلیکیشن قرار گرفته‌اند.


## درباره پروژه
Quera Clock در قالب یک پروژه‌ی آموزشی مرحله‌ای توسعه داده شده است. در فاز اول، تمرکز روی ساخت پایه‌ی پروژه با Django، مدل‌های پایگاه داده، پنل ادمین، قالب‌ها، فرم‌ها و احراز هویت بود.

در فاز دوم، همان پروژه به یک بک‌اند API محور توسعه داده شد و قابلیت‌هایی مانند JWT، صفحه‌بندی، throttling، Celery، اعلان‌ها، SSE، caching و APIهای مربوط به دامنه‌های اصلی محصول به آن اضافه شد.

در نهایت، پروژه به‌عنوان یک نمونه‌ی کامل از توسعه‌ی یک بک‌اند Django از یک ساختار ساده تا یک REST API نسبتاً کامل مورد استفاده قرار گرفت.
</div>

## Frontend
<div dir="rtl">
این پروژه دارای یک Frontend نیز هست که در کنار Backend ارائه شده است.

Frontend توسط تیم آموزشی Quera و در چارچوب دوره‌ی «جامپ بک‌اند با جنگو» ارائه شده است.

برای اجرای Frontend ابتدا وارد پوشه‌ی آن شوید و وابستگی‌ها را نصب کنید:
</div>