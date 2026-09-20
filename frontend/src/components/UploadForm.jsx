// ============================================================================
// UploadForm.jsx
// ----------------------------------------------------------------------------
// فورم رفع بلاغ تلوث جديد: صورة + موقع (تلقائي من المتصفح أو يدوي) + حي +
// ملاحظة اختيارية. بعد الإرسال، بيعرض نتيجة تصنيف الذكاء الاصطناعي.
// ============================================================================

import { useEffect, useState } from 'react';
import { fetchNeighborhoods, submitReport } from '../api';
import { getPollutionInfo } from '../pollutionTypes';

export default function UploadForm({ session }) {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [neighborhoodId, setNeighborhoodId] = useState('');
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [coords, setCoords] = useState({ latitude: '', longitude: '' });
  const [description, setDescription] = useState('');
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNeighborhoods()
      .then(setNeighborhoods)
      .catch(() => setError('ما قدرنا نجيب قائمة الأحياء. تأكد إن السيرفر شغال.'));
  }, []);

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('المتصفح تبعك ما بيدعم تحديد الموقع.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      () => {
        setError('ما قدرنا نجيب موقعك. جرب تسمح للمتصفح بالوصول للموقع، أو دخّل الإحداثيات يدويًا.');
        setLocating(false);
      }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!image) return setError('لازم ترفع صورة.');
    if (!coords.latitude || !coords.longitude) return setError('لازم تحدد الموقع.');

    try {
      setSubmitting(true);
      const data = await submitReport({
        image,
        latitude: coords.latitude,
        longitude: coords.longitude,
        neighborhoodId,
        description,
        // لو مسجّل دخول، منبعت توكن جلسته عشان يترسم البلاغ باسمه
        accessToken: session?.access_token,
      });
      setResult(data);
      // تفريغ الفورم بعد نجاح الإرسال
      setImage(null);
      setPreviewUrl(null);
      setDescription('');
    } catch (err) {
      console.error(err);
      setError('فشل إرسال البلاغ. تأكد إن السيرفر الخلفي شغال وحاول مرة ثانية.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="upload-page">
      <h2>الإبلاغ عن تلوث</h2>
      <form onSubmit={handleSubmit} className="upload-form">
        <label>
          الصورة
          <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} required />
        </label>
        {previewUrl && <img src={previewUrl} alt="معاينة" className="preview-img" />}

        <label>
          الحي
          <select value={neighborhoodId} onChange={(e) => setNeighborhoodId(e.target.value)}>
            <option value="">-- اختر الحي --</option>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>

        <div className="location-row">
          <button type="button" onClick={handleUseMyLocation} disabled={locating}>
            {locating ? 'جارِ تحديد الموقع...' : '📍 استخدم موقعي الحالي'}
          </button>
          <input
            type="number"
            step="any"
            placeholder="خط العرض (latitude)"
            value={coords.latitude}
            onChange={(e) => setCoords({ ...coords, latitude: e.target.value })}
            required
          />
          <input
            type="number"
            step="any"
            placeholder="خط الطول (longitude)"
            value={coords.longitude}
            onChange={(e) => setCoords({ ...coords, longitude: e.target.value })}
            required
          />
        </div>

        <label>
          ملاحظة (اختياري)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>

        <p className="submit-as-hint">
          {session
            ? `رح ينحفظ البلاغ باسم: ${session.user.email}`
            : 'ملاحظة: أنت مش مسجّل دخول، فالبلاغ رح ينحفظ بدون ربطه بأي حساب.'}
        </p>

        <button type="submit" className="primary-btn" disabled={submitting}>
          {submitting ? 'جارِ الإرسال وتحليل الصورة بالذكاء الاصطناعي...' : 'إرسال البلاغ'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="result-card">
          <h3>تم استلام البلاغ ✅</h3>
          <p>
            صنّف الذكاء الاصطناعي الصورة على أنها:{' '}
            <b style={{ color: getPollutionInfo(result.classification.pollutionType).color }}>
              {getPollutionInfo(result.classification.pollutionType).label}
            </b>{' '}
            (نسبة ثقة {Math.round(result.classification.confidence * 100)}%)
          </p>
          <p className="suggestion-text">
            💡 {getPollutionInfo(result.classification.pollutionType).suggestion}
          </p>
          {result.report?.is_duplicate && (
            <p className="duplicate-note">
              ⚠️ في بلاغ مشابه انبعت مؤخرًا قريب من نفس المكان — بلاغك انحفظ عادي وضل ينضاف لتأكيد المشكلة، وفريق الإدارة رح يراجعه.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
