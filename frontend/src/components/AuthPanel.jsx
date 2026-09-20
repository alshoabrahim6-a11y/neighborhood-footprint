// ============================================================================
// AuthPanel.jsx
// ----------------------------------------------------------------------------
// شريط صغير بأعلى الصفحة: لو المستخدم مسجّل دخول، بيوري إيميله وزر خروج.
// لو مش مسجّل، بيوري فورم صغير (إيميل + باسوورد) فيه زرين: "دخول" و"حساب جديد".
//
// ملاحظة: التسجيل هون اختياري — الموقع بيضل يشتغل حتى بدون تسجيل دخول
// (البلاغات العامة والخريطة ونقاط الأحياء كلها متاحة للجميع). ميزة الحساب
// هون بس عشان نعرف "مين بعث أي بلاغ"، وهاي بداية لميزات مستقبلية (لوحة
// إدارة، سجل بلاغاتي الشخصية...).
// ============================================================================

import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthPanel({ session }) {
  const [mode, setMode] = useState('login'); // 'login' أو 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('تم إنشاء الحساب! إذا كان مفعّل تأكيد الإيميل بمشروعك، تأكد من صندوق بريدك قبل ما تسجّل دخول.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setShowForm(false);
      }
      setPassword('');
    } catch (err) {
      // ترجمة أبسط لأشهر رسائل الخطأ من Supabase
      if (err.message?.includes('Invalid login credentials')) {
        setMessage('الإيميل أو الباسوورد غلط.');
      } else if (err.message?.includes('User already registered')) {
        setMessage('هاد الإيميل مسجّل أصلاً — جرب "تسجيل دخول" بدل "حساب جديد".');
      } else {
        setMessage(err.message || 'صار خطأ غير متوقع.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // --- مستخدم مسجّل دخول ---
  if (session) {
    return (
      <div className="auth-bar">
        <span className="auth-email">👤 {session.user.email}</span>
        <button className="auth-link-btn" onClick={handleLogout}>
          تسجيل خروج
        </button>
      </div>
    );
  }

  // --- مستخدم غير مسجّل: زر بسيط يفتح الفورم ---
  if (!showForm) {
    return (
      <div className="auth-bar">
        <span className="auth-hint">بتقدر تبلّغ بدون تسجيل، بس تسجيل الدخول بيخليك تتابع بلاغاتك</span>
        <button className="auth-link-btn" onClick={() => setShowForm(true)}>
          تسجيل دخول / حساب جديد
        </button>
      </div>
    );
  }

  return (
    <div className="auth-bar auth-bar-form">
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="email"
          placeholder="الإيميل"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="الباسوورد (6 أحرف ع الأقل)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <button type="submit" className="primary-btn auth-submit-btn" disabled={loading}>
          {loading ? '...' : mode === 'signup' ? 'إنشاء حساب' : 'دخول'}
        </button>
        <button
          type="button"
          className="auth-link-btn"
          onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
        >
          {mode === 'signup' ? 'عندك حساب؟ سجّل دخول' : 'ما عندك حساب؟ سجّل واحد جديد'}
        </button>
        <button type="button" className="auth-link-btn" onClick={() => setShowForm(false)}>
          إلغاء
        </button>
      </form>
      {message && <p className="auth-message">{message}</p>}
    </div>
  );
}
