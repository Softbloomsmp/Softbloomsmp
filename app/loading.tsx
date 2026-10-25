export default function Loading() {
  return <div className="softbloom-loading" role="status" aria-live="polite">
    <span className="softbloom-loading-flower" aria-hidden="true">🌸</span>
    <span>Gathering blossoms...</span>
    <div className="softbloom-loading-bar" aria-hidden="true" />
  </div>;
}
