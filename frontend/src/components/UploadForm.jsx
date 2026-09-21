// ============================================================================
// UploadForm.jsx
// ----------------------------------------------------------------------------
// Form for submitting a new pollution report: photo + location (automatic
// from the browser or manual) + neighborhood + optional note. After
// submitting, it shows the AI classification result.
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
      .catch(() => setError("Couldn't fetch the neighborhood list. Make sure the server is running."));
  }, []);

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location detection.");
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
        setError('Could not get your location. Try allowing the browser to access your location, or enter the coordinates manually.');
        setLocating(false);
      }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!image) return setError('You must upload a photo.');
    if (!coords.latitude || !coords.longitude) return setError('You must set the location.');

    try {
      setSubmitting(true);
      const data = await submitReport({
        image,
        latitude: coords.latitude,
        longitude: coords.longitude,
        neighborhoodId,
        description,
        // If logged in, send the session token so the report is recorded under their name
        accessToken: session?.access_token,
      });
      setResult(data);
      // Clear the form after a successful submission
      setImage(null);
      setPreviewUrl(null);
      setDescription('');
    } catch (err) {
      console.error(err);
      setError('Failed to submit the report. Make sure the backend server is running and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="upload-page">
      <h2>Report Pollution</h2>
      <form onSubmit={handleSubmit} className="upload-form">
        <label>
          Photo
          <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} required />
        </label>
        {previewUrl && <img src={previewUrl} alt="Preview" className="preview-img" />}

        <label>
          Neighborhood
          <select value={neighborhoodId} onChange={(e) => setNeighborhoodId(e.target.value)}>
            <option value="">-- Select a neighborhood --</option>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>

        <div className="location-row">
          <button type="button" onClick={handleUseMyLocation} disabled={locating}>
            {locating ? 'Locating...' : '📍 Use My Current Location'}
          </button>
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={coords.latitude}
            onChange={(e) => setCoords({ ...coords, latitude: e.target.value })}
            required
          />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={coords.longitude}
            onChange={(e) => setCoords({ ...coords, longitude: e.target.value })}
            required
          />
        </div>

        <label>
          Note (optional)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>

        <p className="submit-as-hint">
          {session
            ? `This report will be saved under: ${session.user.email}`
            : "Note: you're not logged in, so this report will be saved without being linked to any account."}
        </p>

        <button type="submit" className="primary-btn" disabled={submitting}>
          {submitting ? 'Submitting and analyzing the image with AI...' : 'Submit Report'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="result-card">
          <h3>Report Received ✅</h3>
          <p>
            The AI classified the image as:{' '}
            <b style={{ color: getPollutionInfo(result.classification.pollutionType).color }}>
              {getPollutionInfo(result.classification.pollutionType).label}
            </b>{' '}
            (confidence {Math.round(result.classification.confidence * 100)}%)
          </p>
          <p className="suggestion-text">
            💡 {getPollutionInfo(result.classification.pollutionType).suggestion}
          </p>
          {result.report?.is_duplicate && (
            <p className="duplicate-note">
              ⚠️ A similar report was recently submitted near the same location — your report was saved normally and will help confirm the issue, and the admin team will review it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
