// ============================================================================
// AnimatedNumber.jsx
// ----------------------------------------------------------------------------
// مكوّن بسيط بيعرض رقم وبيعمله "عدّاد متحرك" من صفر (أو من آخر قيمة) لحتى
// القيمة الجديدة، بدل ما يطلع الرقم فجأة — لمسة حيوية بسيطة بدون أي
// مكتبة خارجية (بس requestAnimationFrame).
// ============================================================================

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 700;

export default function AnimatedNumber({ value, decimals = 0, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / DURATION_MS);
      // easing بسيط (ease-out) عشان الحركة تبطّئ قرب النهاية، أحلى بصريًا
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return (
    <span>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
