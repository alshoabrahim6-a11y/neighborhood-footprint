import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // ------------------------------------------------------------------
    // دعم PWA (تطبيق ويب تقدمي) — يخلي الموقع:
    //   1) قابل للتثبيت (Add to Home Screen) على الموبايل والكمبيوتر
    //   2) شغال جزئيًا بدون إنترنت: الواجهة نفسها (HTML/CSS/JS) بتنحفظ
    //      محليًا (Service Worker)، وآخر بيانات معروضة (خريطة، إحصائيات،
    //      قائمة أحياء...) بتنحفظ كمان عشان تطلع حتى لو النت مقطوع —
    //      طبعًا إرسال بلاغ جديد أو تسجيل الدخول بيضلوا محتاجين إنترنت
    //      فعلي، هاد بس لتصفح البيانات يلي أصلًا انحفظت قبل الانقطاع.
    // ------------------------------------------------------------------
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      // بنفعّل الـ Service Worker حتى بوضع التطوير (npm run dev)، مش بس
      // بالنسخة النهائية (npm run build) — عشان تقدر تجرب ميزة العمل بدون
      // إنترنت مباشرة وأنت شغّال بالتطوير، بدون ما تحتاج تعمل build يدوي
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'بصمة الحي — Neighborhood Footprint',
        short_name: 'بصمة الحي',
        description: 'رصد التلوث البيئي بمشاركة المجتمع — تطبيق مشروع تخرج',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#1f5c3a',
        background_color: '#f4f7f5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // نحفظ (precache) كل ملفات الواجهة الأساسية تلقائيًا وقت البناء
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          // 1) بلاطات خريطة OpenStreetMap — نحفظها عشان أجزاء الخريطة يلي
          // المستخدم تصفحها قبل تضل تظهر حتى بدون إنترنت
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 2) صور بلاغات التلوث المرفوعة على Supabase Storage
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'report-images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 14 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 3) بيانات السيرفر الخلفي (خريطة، إحصائيات، أحياء...) — بنجرب
          // الشبكة أولًا دايمًا (عشان البيانات تكون حديثة)، ولو ما في
          // إنترنت منستخدم آخر نسخة محفوظة بدل ما تطلع صفحة فاضية
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/api\/(reports|neighborhoods)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-data-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 3 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
