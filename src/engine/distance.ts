/** Manhattan distance between two grid coordinates. */
export function manhattanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/** Returns true if the distance is within the given range (999 = ∞). */
export function isInRange(range: number, distance: number): boolean {
  if (range >= 999) return true;
  return distance <= range;
}
