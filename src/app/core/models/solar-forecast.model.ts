export interface SolarForecastRequest {
  lat: number;
  lon: number;
  capacityKw: number;
  tilt: number;
  azimuth: number;
  efficiency: number; // 0–1  e.g. 0.20
  losses: number;     // 0–1  e.g. 0.14
}

export interface SolarForecastPoint {
  ts: number;              // epoch ms UTC
  inverterAcPower: number; // kW AC
}
