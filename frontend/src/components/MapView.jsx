// ============================================================================
// MapView.jsx
// ----------------------------------------------------------------------------
// A live heatmap showing pollution locations + markers for each report.
//
// We use the Leaflet library directly (not via react-leaflet) so it's clear
// step by step what's happening: we create a map, add a heat layer to it,
// and add report markers.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { fetchHeatmapPoints, fetchReports } from '../api';
import { getPollutionInfo } from '../pollutionTypes';
import { supabase } from '../supabaseClient';

// Fix a common issue: Leaflet's default marker icon doesn't show correctly
// with build tools like Vite, so we set the image paths manually.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Default coordinates for the map's starting view (change this for your city) — currently roughly central Malaysia
const DEFAULT_CENTER = [3.139, 101.6869]; // Kuala Lumpur, as an example
const DEFAULT_ZOOM = 12;

export default function MapView() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportCount, setReportCount] = useState(0);
  const [liveStatus, setLiveStatus] = useState('connecting');

  // All the layers we add to the map (the heat layer + report markers) — we
  // track them here so we can clear them before drawing the new batch when
  // a live update arrives. Without this, every update would "pile up"
  // points on top of old ones.
  const layersRef = useRef([]);

  const loadData = useCallback(async (map) => {
    try {
      setLoading(true);
      const [heatPoints, reports] = await Promise.all([fetchHeatmapPoints(), fetchReports()]);

      // 🛡️ Protection against "the map was removed while we were waiting
      // for the server's response": this happens especially in dev mode
      // (npm run dev) because React (StrictMode) "trial-runs" every
      // useEffect: it runs it, tears it down (cleanup), and runs it again —
      // specifically to catch bugs like this. If the network request
      // finishes after the old map was removed (map.remove()), trying to
      // use it would cause a "Cannot read properties of undefined (reading
      // 'appendChild')" error because Leaflet no longer has "panes" to add
      // layers to. The fix: make sure the map we're about to use is still
      // the "current" map (mapRef.current) before touching it.
      if (mapRef.current !== map) return;

      // Clear all previously drawn layers (if this is a second or later
      // update due to a live update), so we draw the new batch cleanly
      layersRef.current.forEach((layer) => map.removeLayer(layer));
      layersRef.current = [];

      // 1) The heat layer
      if (heatPoints.length > 0) {
        const heatLayer = L.heatLayer(heatPoints, { radius: 30, blur: 20, maxZoom: 17 }).addTo(map);
        layersRef.current.push(heatLayer);
      }

      // 2) A marker for every report with info in a popup
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
          : 'unknown';

        marker.bindPopup(`
          <div style="text-align:left; font-family: sans-serif; min-width:180px">
            <img src="${report.image_url}" style="width:100%; border-radius:6px; margin-bottom:6px" />
            <b>${info.label}</b><br/>
            AI confidence: ${confidencePct}<br/>
            ${report.neighborhoods?.name ? `Neighborhood: ${report.neighborhoods.name}<br/>` : ''}
            ${report.user_email ? `Reported by: ${report.user_email}<br/>` : ''}
            ${report.description ? `Note: ${report.description}<br/>` : ''}
            <span style="color:#1f5c3a">💡 ${info.suggestion}</span>
          </div>
        `);
      });

      setReportCount(reports.length);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Couldn't fetch map data. Make sure the backend server is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Create the map only once (when the component first appears)
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    loadData(map);

    // ------------------------------------------------------------------
    // Realtime updates: we subscribe to a Supabase Realtime channel so we
    // know as soon as any change happens in the reports table (a new
    // report, an approval, a rejection...) without the user needing to
    // manually refresh the page. As soon as any notification arrives, we
    // reload the map data (loadData) again.
    //
    // ⚠️ The reports table must have "Realtime" enabled in the Supabase
    // settings (see database/migrations/003_enable_realtime.sql), otherwise
    // no notifications will reach us (the map will still work fine, just
    // without live updates).
    let refreshTimeout = null;
    const scheduleRefresh = () => {
      // A simple debounce: if several notifications arrive close together
      // (e.g. a new report followed by its approval a second later), we
      // do just one refresh request instead of hitting the server for
      // every notification
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

    // Clean up the map and subscription when the component unmounts (avoid memory leaks)
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
        <h2>Pollution Heatmap</h2>
        <div className="map-header-badges">
          {liveStatus === 'live' && <span className="live-badge">🟢 Live updates enabled</span>}
          {!loading && !error && <span className="badge">{reportCount} reports recorded</span>}
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div ref={mapContainerRef} className="map-container" />
    </div>
  );
}
