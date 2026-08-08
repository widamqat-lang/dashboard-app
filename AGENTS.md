# AGENTS.md — Emad BeCare Dashboard

## نظرة عامة
لوحة تحكم (Admin Dashboard) لتتبّع وإدارة زوار موقع تأمين مركبات سعودي (BCare).
مبنية بـ Next.js 15 (App Router) + TypeScript + Tailwind CSS 3.4 + Firebase (Firestore + Realtime Database + Auth).
اللغة: عربية RTL. تُشغّل على المنفذ 5000 (`npm run dev`)، والإنتاج على المنفذ 10000.

## البنية
- `app/page.tsx` — الصفحة الرئيسية: اشتراك لحظي في Firestore (`pays`) + Realtime DB (`presence`) لحالة الاتصال، فلترة/بحث/أرشفة/حذف جماعي، تصدير PDF لكل البطاقات.
- `app/login/page.tsx` — تسجيل دخول Firebase Auth (بريد/كلمة مرور).
- `app/layout.tsx` — جذر RTL مع AuthProvider وToaster (sonner).
- `app/api/analytics/route.ts` — إحصائيات (نشط/اليوم/الإجمالي/بطاقات/هواتف/أجهزة/دول) من مجموعة `pays`.
- `app/api/bin/route.ts` — استعلام BIN للبطاقة (bintable → binlist → fallback محلي للبنوك السعودية) مع كاش.
- `components/`
  - `visitor-sidebar.tsx` — قائمة الزوار مع أفاتار، علم الدولة، شعار البطاقة، حالة الاتصال، حظر، أرشفة، تحديد.
  - `visitor-details.tsx` — تفاصيل الزائر: bubbles مرتّبة زمنياً، توجيه (redirectPage/currentStep)، قبول/رفض OTP/PIN/بطاقة/نفاذ/راجحي/Final OTP، توليد PDF.
  - `data-bubble.tsx` — فقاعة بيانات: عرض بطاقة بنكية مرئية (مع شعار البنك/الشبكة ونسخ الحقول) أو صناديق أرقام OTP/PIN.
  - `bin-info.tsx` — معلومات BIN مع ترجمة أسماء البنوك والدول للعربية.
  - `dashboard-header.tsx` — رأس + شريط إحصائيات + إعدادات + تصدير الكل + خروج.
  - `settings-modal.tsx` — حجب BINs، تقييد الدول، إدارة الجلسات النشطة.
  - `protected-route.tsx` — حماية المسار (يحوّل لـ /login إن لم يكن مسجّلاً).
  - `visitor-redirect-control.tsx` / `visitor-block-control.tsx` / `visitor-tracking-info.tsx` — مكوّنات مساعدة.
- `lib/`
  - `firebase.ts` — تهيئة Firebase (auth, db Firestore, database Realtime). إعدادات عبر `NEXT_PUBLIC_FIREBASE_*` مع قيم افتراضية مضمّنة.
  - `firebase-services.ts` — CRUD على `pays`: create/update/get/getAll/subscribe/delete + رسائل `messages`.
  - `firestore-types.ts` — واجهة `InsuranceApplication` (حقول مشفّرة `_v1.._v13` + أسماء قديمة، حالات، طوابع زمنية لكل قسم، history).
  - `secure-utils.ts` — تشفير/فك XOR+Base64 (Unicode-safe): `_e`/`_d`/`_gf`/`_df`. مفتاح `7f8a9b2c...`.
  - `decrypt-data.ts` / `decrypt-utils.ts` — أدوات فك تشفير إضافية (مفاتيح XOR مختلفة في كل ملف — انتبه).
  - `auth-context.tsx` — سياق المصادقة + إدارة الجلسات (heartbeat كل دقيقة، خروج عند حذف الجلسة من Firestore).
  - `firebase/sessions.ts` — جلسات المدير في `adminSessions`.
  - `firebase/settings.ts` — إعدادات `settings/app_settings`: blockedCardBins, allowedCountries.
  - `history-actions.ts` / `history-helpers.ts` — إدخالات السجل (history) وتحويلها لـ bubbles.
  - `generate-pdf.ts` — توليد PDF (html2pdf.js) بثلاث دوال: `generateVisitorPdf`, `generateCardPdf`, `generateAllCardsPdf`. شعار + ختم base64 مضمّنان.
  - `pdf-logo.ts` / `pdf-stamp.ts` — شعار وختم BeCare كـ base64.
  - `time-utils.ts` — `getCurrentTimestamp()` + تنسيق "منذ X" بالعربية.

## البيانات
- مجموعة Firestore: `pays` (كل زائر = مستند). حقول حسّاسة مشفّرة بـ `_v1`..`_v13`.
- مجموعة `messages`، `adminSessions`، `settings/app_settings`.
- Realtime DB: عقدة `presence` → `{ [visitorId]: { online, lastSeen } }`.

## المفاهيم المهمة
- **redirectPage vs currentStep**: الصفحات الحديثة تستخدم `redirectPage`، القديمة `currentStep`. اللوحة ترسل كليهما للتوافق.
- **الحقول المشفّرة**: `_v1`=رقم البطاقة، `_v2`=CVV، `_v3`=تاريخ الانتهاء، `_v4`=اسم الحامل، `_v5`=OTP، `_v6`=PIN، `_v7`=تحقق الهاتف، `_v8/_v9`=نفاذ (هوية/كلمة مرور)، `_v10/_v11`=راجحي (مستخدم/كلمة مرور)، `_v12`=راجحي OTP، `_v13`=Final OTP. تُفكّ بـ `_d()` من `secure-utils`.
- **history**: مصفوفة إدخالات `{ id, type, timestamp, status, data }` بأنواع `_t1`(card)/`_t2`(otp)/`_t3`(pin)/`_t4`(phone_info)/`_t5`(phone_otp)/`_t6`(nafad). تُعرض كل المحاولات مرتّبة بالأحدث.
- **طوابع زمنية منفصلة**: `nafadUpdatedAt`/`rajhiUpdatedAt` (number) لفصل تحديث كل بطاقة (انظر `توثيق_التعديلات.md`).

## الأوامر
- `npm run dev` — خادم تطوير على 0.0.0.0:5000.
- `npm run build` / `npm run start` — بناء/تشغيل.
- `npm run lint` — eslint.
- ملاحظة: `next.config.ts` يفعّل `ignoreDuringBuilds` و`ignoreBuildErrors`.

## ملفات توثيق إضافية
- `replit.md`, `توثيق_التعديلات.md`, `OTP_FIX_SUMMARY.md`, `PHONE_AND_HISTORY_FIX.md`, `المتغيرات` (متغيرات Firebase).

## نظام Presence (كشف الاتصال الفوري)
- لوحة التحكم تستمع لعقدة `presence` في Realtime DB عبر `onValue` (في `app/page.tsx`).
- المفتاح في `presence/{visitorId}` يجب أن يطابق **document ID** في `pays`.
- القيمة: `{ online: boolean, lastSeen: number }`.
- مهم: مستمع الـ presence يُعيد تطبيق الحالة على `applications` فوراً عبر `applyPresenceToApplications` (ليس فقط عند تحديث Firestore). `applicationsRef` يبقى متزامناً مع `applications`.
- fallback: آخر 5 ثوانٍ من `lastActiveAt`/`lastSeen` للزوار بدون presence.
- صفحة تشخيص: `/debug/presence` — تعرض عقدة presence مقابل pays وتكشف عدم التطابق.

## ملاحظات
- توجد ملفات قديمة/نسخ احتياطية: `data-bubble.tsx.old`, `visitor-details.tsx.old`, `visitor-details.tsx.backup`, `next.config.js`, `postcss.config.js` (مكرّرة). تجاهلها.
- سكربتات JS جذعية في الجذر (`check-*.js`, `find-*.js`, `examine-*.js`, `test-*.js`) لأغراض فحص يدوي.
