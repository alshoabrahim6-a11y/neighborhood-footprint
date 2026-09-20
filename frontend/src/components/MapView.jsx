// ============================================================================
// MapView.jsx
// ----------------------------------------------------------------------------
// خريطة حرارية (heatmap) حية توضح أماكن التلوث + نقاط (markers) لكل بلاغ.
//
// بنستخدم مكتبة Leaflet مباشرة (مش عبر react-leaflet) عشان يكون واضح خطوة
// خطوة شو عم يصير: نعمل خريطة، نحط عليها طبقة حرارية، ونحط نقاط البلاغات.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { fetchHeatmapPoints, fetchReports } from '../api';
import { getPollutionInfo } from '../pollutionTypes';
import { supabase } from '../supabaseClient';

// إصلاح مشكلة شائعة: أيقونة الـ marker الافتراضية بـ Leaflet ما بتظهر صح
// مع أدوات البناء متل Vite، فبنحدد مسارات الصور يدويًا.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// إحداثيات افتراضية لبداية الخريطة (غيّرها لمدينتك) — هاي حاليًا تقريبًا وسط ماليزيا
const DEFAULT_CENTER = [3.139, 101.6869]; // كوالالمبور، كمثال
const DEFAULT_ZOOM = 12;

export default function MapView() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportCount, setReportCount] = useState(0);
  const [liveStatus, setLiveStatus] = useState('connecting');

  // كل الطبقات يلي منضيفها للخريطة (الطبقة الحرارية + نقاط البلاغات) —
  // منتتبعها هون عشان نقدر نمسحها قبل ما نرسم الدفعة الجديدة، لما تحديث
  // لحظي يوصل. من دون هاد، كل تحديث رح "يكوّم" نقاط فوق نقاط قديمة.
  const layersRef = useRef([]);

  const loadData = useCallback(async (map) => {
    try {
      setLoading(true);
      const [heatPoints, reports] = await Promise.all([fetchHeatmapPoints(), fetchReports()]);

      // 🛡️ حماية من "خريطة اتشالت أثناء ما كنا منستنى رد السيرفر":
      // هاد بيصير خصوصًا بوضع التطوير (npm run dev) لأن React (StrictMode)
      // بيعمل "تجربة" لكل useEffect: يشغّله، يلغيه (cleanup)، ويشغّله من
      // جديد — عشان يكشف بالضبط هيك أخطاء. إذا خلص طلب الشبكة بعد ما
      // الخريطة القديمة انشالت (map.remove())، محاولة نستخدمها كانت
      // بتسبب خطأ "Cannot read properties of undefined (reading
      // 'appendChild')" لأن Leaflet ما عاد عندها "أماكن" (panes) نحط
      // فيها الطبقات. الحل: نتأكد إن الخريطة يلي بيدنا نستخدمها لسا هي
      // نفسها الخريطة "الحالية" (mapRef.current) قبل ما نلمسها.
      if (mapRef.current !== map) return;

      // نمسح كل الطبقات يلي كانت مرسومة من قبل (لو هاد تحديث ثاني أو
      // أكتر بسبب التحديث اللحظي)، عشان نرسم الدفعة الجديدة نظيفة
      layersRef.current.forEach((layer) => map.removeLayer(layer));
      layersRef.current = [];

      // 1) الطبقة الحرارية
      if (heatPoints.length > 0) {
        const heatLayer = L.heatLayer(heatPoints, { radius: 30, blur: 20, maxZoom: 17 }).addTo(map);
        layersRef.current.push(heatLayer);
      }

      // 2) نقطة (marker) لكل بلاغ مع معلومات بالنافذة المنبثقة (popup)
      reports.forEach((report) => {
        const info = getPollutionInfo(report.pollution_type);
        const marker = L.circleMarker([report.latitude, report.longitude], {
          radius: 8,
          color: info.color,
          fillColor: info.color,
          fillOpacity: 0.8,
        }).addTo(map);
        layersRef.current.push(marker);

        const confidencePct = report.ai_confidence
          ? `${Math.round(report.ai_confidence * 100)}%`
          : 'غير معروف';

        marker.bindPopup(`
          <div style="text-align:right; font-family: sans-serif; min-width:180px">
            <img src="${report.image_url}" style="width:100%; border-radius:6px; margin-bottom:6px" />
            <b>${info.label}</b><br/>
            نسبة ثقة الذكاء الاصطناعي: ${confidencePct}<br/>
            ${report.neighborhoods?.name ? `الحي: ${report.neighborhoods.name}<br/>` : ''}
            ${report.user_email ? `بلّغ بواسطة: ${report.user_email}<br/>` : ''}
            ${report.description ? `ملاحظة: ${report.description}<br/>` : ''}
            <span style="color:#1f5c3a">💡 ${info.suggestion}</span>
          </div>
        `);
      });

      setReportCount(reports.length);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('ما قدرنا نجيب بيانات الخريطة. تأكد إن السيرفر الخلفي شغال.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // نعمل الخريطة مرة وحدة بس (لما الكومبوننت يظهر أول مرة)
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    loadData(map);

    // ------------------------------------------------------------------
    // تحديث لحظي (Realtime): منشترك بقناة Supabase Realtime عشان نعرف
    // أول ما يصير أي تغيير بجدول reports (بلاغ جديد، موافقة، رفض...)
    // بدون ما المستخدم يحتاج يعمل Refresh يدويًا للصفحة. أول ما توصل أي
    // إشعار، منعيد تحميل بيانات الخريطة (loadData) من جديد.
    //
    // ⚠️ لازم يكون جدول reports مفعّل فيه "Realtime" من إعدادات Supabase
    // (راجع database/migrations/003_enable_realtime.sql)، وإلا ما رح
    // توصلنا أي إشعارات (الخريطة بتضل شغالة عادي بس بدون تحديث لحظي).
    let refreshTimeout = null;
    const scheduleRefresh = () => {
      // "تهدئة" بسيطة (debounce): لو وصلت كذا إشعار قريبين من بعض (مثلاً
      // بلاغ جديد ثم موافقة عليه بعد ثانية)، منسوي طلب تحديث واحد بس
      // بدل ما نضرب السيرفر بطلب لكل إشعار
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        if (mapRef.current === map) loadData(map);
      }, 800);
    };

    const channel = supabase
      .channel('public:reports:map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, scheduleRefresh)
      .subscribe((status) => {
        setLiveStatus(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'idle' : 'error');
      });

    // تنظيف الخريطة والاشتراك لما الكومبوننت يختفي (تجنب تسريب الذاكرة)
    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      supabase.removeChannel(channel);
      map.remove();
      mapRef.current = null;
    };
  }, [loadData]);

  return (
    <div className="map-page">
      <div className="map-header">
        <h2>خريطة التلوث الحرارية</h2>
        <div className="map-header-badges">
          {liveStatus === 'live' && <span className="live-badge">🟢 تحديث لحظي مفعّل</span>}
          {!loading && !error && <span className="badge">{reportCount} بلاغ مسجّل</span>}
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div ref={mapContainerRef} className="map-container" />
    </div>
  );
}
