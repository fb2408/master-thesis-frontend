export type DataResolution = 'PT15M' | 'PT60M';

export interface DayAheadPricePoint {
  timeStart: string;       // ISO 8601 LocalDateTime from backend
  price: number;
  currency: string;
  resolution: DataResolution;
}

export interface PriceStats {
  min: number;
  max: number;
  avg: number;
  current: number | null;
  currency: string;
}
