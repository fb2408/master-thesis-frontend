import { SolarForecastPoint } from './solar-forecast.model';
import { DayAheadPricePoint } from './day-ahead-price.model';

export const TARIFF_MODELS = [
  'Poduzetništvo NN Crveni',
  'Poduzetništvo NN Bijeli',
  'Poduzetništvo NN Plavi',
  'Poduzetništvo SN Bijeli',
] as const;

export type TariffModel = typeof TARIFF_MODELS[number];

export interface BatteryOptRequest {
  tariffModel: TariffModel;
  battery: {
    powerKw: number;
    capacityKwh: number;
    initialSocKwh: number;
  };
  gridConnection: {
    importKw: number;
    exportKw: number;
  };
  solarForecast: SolarForecastPoint[];
  prices: DayAheadPricePoint[];
}

export interface BatterySchedulePoint {
  ts: number; // epoch seconds
  values: {
    p_import_kwh:    number;
    p_export_kwh:    number;
    p_charge_kwh:    number;
    p_discharge_kwh: number;
    soc_kwh:         number;
  };
}

export interface BatteryOptResult {
  schedule: BatterySchedulePoint[];
}
