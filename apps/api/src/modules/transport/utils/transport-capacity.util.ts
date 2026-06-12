export const DEFAULT_CAPACITY_WARNING_PERCENT = 90;

export type RouteCapacitySnapshot = {
  assigned: number;
  capacity: number;
  utilizationPct: number;
  atCapacity: boolean;
  nearCapacity: boolean;
  warningPercent: number;
};

export function buildRouteCapacitySnapshot(
  assigned: number,
  capacity: number,
  warningPercent = DEFAULT_CAPACITY_WARNING_PERCENT,
): RouteCapacitySnapshot {
  const utilizationPct =
    capacity > 0 ? Math.round((assigned / capacity) * 100) : 0;
  const threshold = Math.ceil((capacity * warningPercent) / 100);
  return {
    assigned,
    capacity,
    utilizationPct,
    atCapacity: capacity > 0 && assigned >= capacity,
    nearCapacity: capacity > 0 && assigned >= threshold && assigned < capacity,
    warningPercent,
  };
}

export function sumVehicleCapacity(vehicles: { capacity: number }[]): number {
  return vehicles.reduce((sum, v) => sum + v.capacity, 0);
}
