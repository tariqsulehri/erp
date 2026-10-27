/** Grey placeholder shown while data loads. Hidden from screen readers; pair it with an aria-busy container. */
export function Skeleton({ width = '100%', height = 14, radius }: { width?: number | string; height?: number | string; radius?: number | string }) {
  return <span className="skeleton" aria-hidden style={{ display: 'block', width, height, borderRadius: radius }} />;
}
