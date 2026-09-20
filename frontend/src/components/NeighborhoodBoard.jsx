// ============================================================================
// NeighborhoodBoard.jsx
// ----------------------------------------------------------------------------
// لوحة تعرض كل حي مع "نقاطه البيئية" (eco points) — من 0 (وضع سيء) لـ 100
// (نظيف). النقاط بتنزل مع كل بلاغ تلوث وبترجع تزيد تدريجيًا بدون بلاغات.
// ============================================================================

import { useEffect, useState } from 'react';
import { fetchNeighborhoods } from '../api';
import AnimatedNumber from './AnimatedNumber';

function pointsColor(points) {
  if (points >= 70) return '#2e7a3f'; // أخضر
  if (points >= 40) return '#c98a1b'; // برتقالي
  return '#a12e2e'; // أحمر
}

export default function NeighborhoodBoard() {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNeighborhoods()
      .then(setNeighborhoods)
      .catch(() => setError('ما قدرنا نجيب بيانات الأحياء. تأكد إن السيرفر شغال.'));
  }, []);

  return (
    <div className="board-page">
      <h2>لوحة النقاط البيئية للأحياء</h2>
      {error && <p className="error-text">{error}</p>}
      <div className="neighborhood-list">
        {neighborhoods.map((n, index) => (
          <div
            key={n.id}
            className="neighborhood-card fade-in-item"
            style={{ '--i': Math.min(index, 10) }}
          >
            <div className="neighborhood-name">{n.name}</div>
            <div className="points-bar-bg">
              <div
                className="points-bar-fill"
                style={{ width: `${n.eco_points}%`, backgroundColor: pointsColor(n.eco_points) }}
              />
            </div>
            <div className="points-value">
              <AnimatedNumber value={Math.round(n.eco_points)} /> / 100
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
