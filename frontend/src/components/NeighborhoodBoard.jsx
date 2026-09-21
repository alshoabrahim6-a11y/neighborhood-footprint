// ============================================================================
// NeighborhoodBoard.jsx
// ----------------------------------------------------------------------------
// A board showing each neighborhood with its "eco points" — from 0 (bad
// condition) to 100 (clean). Points drop with each pollution report and
// gradually recover over time without new reports.
// ============================================================================

import { useEffect, useState } from 'react';
import { fetchNeighborhoods } from '../api';
import AnimatedNumber from './AnimatedNumber';

function pointsColor(points) {
  if (points >= 70) return '#2e7a3f'; // green
  if (points >= 40) return '#c98a1b'; // orange
  return '#a12e2e'; // red
}

export default function NeighborhoodBoard() {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNeighborhoods()
      .then(setNeighborhoods)
      .catch(() => setError("Couldn't fetch neighborhood data. Make sure the server is running."));
  }, []);

  return (
    <div className="board-page">
      <h2>Neighborhood Eco Points Board</h2>
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
