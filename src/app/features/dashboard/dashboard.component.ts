import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EnergyPricesService } from '../../core/services/energy-prices.service';
import { SolarForecastService } from '../../core/services/solar-forecast.service';
import { BatteryOptimizationService } from '../../core/services/battery-optimization.service';
import { DayAheadPricePoint, PriceStats } from '../../core/models/day-ahead-price.model';
import { SolarForecastPoint } from '../../core/models/solar-forecast.model';
import { BatteryOptResult, TARIFF_MODELS } from '../../core/models/battery-optimization.model';
import { PriceChartComponent } from './components/price-chart/price-chart.component';
import { BatteryChartComponent } from './components/battery-chart/battery-chart.component';
import { ChartData, ChartOptions, TooltipItem } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, PriceChartComponent, BatteryChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly priceService   = inject(EnergyPricesService);
  private readonly solarService   = inject(SolarForecastService);
  private readonly batteryService = inject(BatteryOptimizationService);

  // ── Price state ──────────────────────────────────────────────────────────
  prices  = signal<DayAheadPricePoint[]>([]);
  loading = signal(false);
  error   = signal<string | null>(null);

  fromDate = '';
  toDate   = '';

  // ── Solar state ──────────────────────────────────────────────────────────
  solarForecast = signal<SolarForecastPoint[]>([]);
  solarError    = signal<string | null>(null);

  solarLat        = 45.815;
  solarLon        = 15.966;
  solarCapacityKw = 100.0;
  solarTilt       = 30;
  solarAzimuth    = 180;
  solarEfficiency = 20;
  solarLosses     = 14;

  // ── Derived: price stats ─────────────────────────────────────────────────
  stats = computed<PriceStats | null>(() => {
    const pts = this.prices();
    if (!pts.length) return null;
    const vals = pts.map(p => p.price);
    const now = new Date();
    const current = pts.find(p => {
      const t = new Date(p.timeStart + 'Z'); // UTC LocalDateTime
      return Math.abs(t.getTime() - now.getTime()) < 30 * 60 * 1000;
    });
    return {
      min:      Math.min(...vals),
      max:      Math.max(...vals),
      avg:      vals.reduce((a, b) => a + b, 0) / vals.length,
      current:  current?.price ?? null,
      currency: pts[0]?.currency ?? 'EUR',
    };
  });

  // ── Derived: solar stats ─────────────────────────────────────────────────
  solarStats = computed(() => {
    const pts = this.solarForecast();
    if (!pts.length) return null;
    const peakPower   = Math.max(...pts.map(p => p.inverterAcPower));
    const totalEnergy = pts.reduce((s, p) => s + p.inverterAcPower * 0.25, 0);
    return { peakPower, totalEnergy, count: pts.length };
  });

  // ── Battery optimization state ────────────────────────────────────────────
  readonly tariffModels = TARIFF_MODELS;
  batteryTariff:      string  = TARIFF_MODELS[0];
  batteryPowerKw:     number  = 100;
  batteryCapacityKwh: number  = 200;
  batteryInitSocKwh:  number  = 200;
  gridImportKw:       number  = 100;
  gridExportKw:       number  = 100;

  batteryResult   = signal<BatteryOptResult | null>(null);
  batteryLoading  = signal(false);
  batteryError    = signal<string | null>(null);

  // ── Battery schedule chart data ───────────────────────────────────────────
  readonly batteryChartData = computed<ChartData>(() => {
    const result = this.batteryResult();
    if (!result) return { datasets: [] };

    const schedule = result.schedule;

    return {
      datasets: [
        {
          label: 'Grid (Import + / Export −)',
          data: schedule.map(r => ({
            x: r.ts * 1000,
            y: r.values['p_import_kwh'] - r.values['p_export_kwh'],
          })),
          backgroundColor: schedule.map(r =>
            (r.values['p_import_kwh'] - r.values['p_export_kwh']) >= 0
              ? 'rgba(212, 135, 10, 0.75)' : 'rgba(59, 130, 246, 0.75)'
          ) as string[],
          borderColor: schedule.map(r =>
            (r.values['p_import_kwh'] - r.values['p_export_kwh']) >= 0
              ? '#d4870a' : '#3b82f6'
          ) as string[],
          borderWidth: 1,
          order: 1,
        },
        {
          label: 'Battery (Charge + / Discharge −)',
          data: schedule.map(r => ({
            x: r.ts * 1000,
            y: r.values['p_charge_kwh'] - r.values['p_discharge_kwh'],
          })),
          backgroundColor: schedule.map(r =>
            (r.values['p_charge_kwh'] - r.values['p_discharge_kwh']) >= 0
              ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.75)'
          ) as string[],
          borderColor: schedule.map(r =>
            (r.values['p_charge_kwh'] - r.values['p_discharge_kwh']) >= 0
              ? '#10b981' : '#ef4444'
          ) as string[],
          borderWidth: 1,
          order: 2,
        },
        {
          type: 'line' as const,
          label: 'SOC (kWh)',
          data: schedule.map(r => ({ x: r.ts * 1000, y: r.values['soc_kwh'] })),
          yAxisID: 'ySoc',
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#8b5cf6',
          order: 0,
        },
      ],
    };
  });

  readonly batteryChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#4b5563',
          font: { family: "'JetBrains Mono'", size: 11 },
          usePointStyle: true,
          padding: 16,
          generateLabels: () => [
            { text: 'Import',     fillStyle: 'rgba(212, 135, 10, 0.75)',  strokeStyle: '#d4870a',  lineWidth: 1, pointStyle: 'rect' },
            { text: 'Export',     fillStyle: 'rgba(59, 130, 246, 0.75)',  strokeStyle: '#3b82f6',  lineWidth: 1, pointStyle: 'rect' },
            { text: 'Charge',     fillStyle: 'rgba(16, 185, 129, 0.75)', strokeStyle: '#10b981',  lineWidth: 1, pointStyle: 'rect' },
            { text: 'Discharge',  fillStyle: 'rgba(239, 68, 68, 0.75)',  strokeStyle: '#ef4444',  lineWidth: 1, pointStyle: 'rect' },
            { text: 'SOC',        fillStyle: 'rgba(139, 92, 246, 0.08)', strokeStyle: '#8b5cf6',  lineWidth: 2, pointStyle: 'line' },
          ],
        },
      },
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: '#e2e6ed',
        borderWidth: 1,
        titleColor: '#4b5563',
        bodyColor: '#111827',
        padding: 12,
        callbacks: {
          title: (items) => {
            const x = items[0]?.parsed.x;
            if (x == null) return '';
            return new Date(x).toLocaleString('hr-HR', {
              day: '2-digit', month: '2-digit',
              hour: '2-digit', minute: '2-digit',
            });
          },
          label: (item) => {
            const v = item.parsed.y ?? 0;
            if (item.datasetIndex === 2) return `  SOC: ${v.toFixed(2)} kWh`;
            if (item.datasetIndex === 0) {
              return v >= 0
                ? `  Import: ${v.toFixed(3)} kWh`
                : `  Export: ${Math.abs(v).toFixed(3)} kWh`;
            }
            return v >= 0
              ? `  Charge: ${v.toFixed(3)} kWh`
              : `  Discharge: ${Math.abs(v).toFixed(3)} kWh`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: { tooltipFormat: 'dd.MM.yyyy HH:mm' },
        grid:   { color: 'rgba(226, 230, 237, 0.8)', drawTicks: false },
        border: { color: '#e2e6ed' },
        ticks: {
          color: '#4b5563',
          font:  { family: "'JetBrains Mono'", size: 11 },
          maxTicksLimit: 12,
          maxRotation: 0,
        },
      },
      y: {
        beginAtZero: false,
        grid:   { color: 'rgba(226, 230, 237, 0.8)', drawTicks: false },
        border: { color: '#e2e6ed' },
        ticks: {
          color: '#4b5563',
          font:  { family: "'JetBrains Mono'", size: 11 },
          callback: (v) => `${v} kWh`,
        },
      },
      ySoc: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        grid:   { drawOnChartArea: false },
        border: { color: 'rgba(139,92,246,0.3)', dash: [4, 4] },
        ticks: {
          color: '#8b5cf6',
          font:  { family: "'JetBrains Mono'", size: 11 },
          callback: (v) => `${v} kWh`,
        },
        title: {
          display: true,
          text: 'SOC',
          color: '#8b5cf6',
          font: { family: "'JetBrains Mono'", size: 9 },
          padding: { bottom: 4 },
        },
      },
    },
  };

  optimizeBattery(): void {
    const prices = this.prices();
    const solar  = this.solarForecast();
    if (!solar.length || !prices.length) {
      this.batteryError.set('Fetch prices and solar forecast first.');
      return;
    }

    // Build exact set of 15-min price timestamps (expand hourly PT60M → 4 slots)
    const priceTs15Set = new Set<number>();
    for (const p of prices) {
      const baseMs = new Date(p.timeStart + 'Z').getTime();
      const slots = p.resolution === 'PT60M' ? 4 : 1;
      for (let i = 0; i < slots; i++) {
        priceTs15Set.add(baseMs + i * 15 * 60 * 1000);
      }
    }

    // Keep only solar points that fall on an exact price 15-min slot
    const filteredSolar = solar.filter(p => priceTs15Set.has(p.ts));

    if (!filteredSolar.length) {
      this.batteryError.set('Solar forecast does not overlap with the selected price window.');
      return;
    }

    this.batteryLoading.set(true);
    this.batteryError.set(null);
    this.batteryResult.set(null);

    this.batteryService.optimize({
      tariffModel:    this.batteryTariff as any,
      battery:        { powerKw: this.batteryPowerKw, capacityKwh: this.batteryCapacityKwh, initialSocKwh: this.batteryInitSocKwh },
      gridConnection: { importKw: this.gridImportKw, exportKw: this.gridExportKw },
      solarForecast:  filteredSolar,
      prices,
    }).subscribe({
      next: result => {
        this.batteryResult.set(result);
        this.batteryLoading.set(false);
      },
      error: err => {
        this.batteryError.set(err?.error ?? err?.message ?? 'Battery optimization failed.');
        this.batteryLoading.set(false);
      },
    });
  }

  // ── Chart data (reacts to signal changes) ────────────────────────────────
  readonly chartData = computed<ChartData<'line'>>(() => {
    const prices = this.prices();
    const solarForecast = this.solarForecast();

    // Derive UTC time window from price timestamps (timeStart is UTC LocalDateTime, append 'Z')
    const priceTs = prices.map(p => new Date(p.timeStart + 'Z').getTime());
    const minTs   = priceTs.length ? Math.min(...priceTs) : null;
    const maxTs   = priceTs.length ? Math.max(...priceTs) + 60 * 60 * 1000 : null; // include last hour

    // Filter 3-day solar forecast down to the price date range
    const filteredSolar = minTs != null && maxTs != null
      ? solarForecast.filter(p => p.ts >= minTs && p.ts <= maxTs)
      : solarForecast;

    return {
      datasets: [
        {
          label: 'Solar AC Power (kW)',
          data: filteredSolar.map(p => ({ x: p.ts, y: p.inverterAcPower })),
          yAxisID: 'ySolar',
          borderColor: '#0099bb',
          backgroundColor: 'rgba(0, 153, 187, 0.15)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#0099bb',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          order: 2,
        },
        {
          label: 'Day-ahead Price (EUR/MWh)',
          data: prices.map(p => ({
            x: new Date(p.timeStart + 'Z').getTime(), // treat as UTC to align with solar ts
            y: p.price,
          })),
          yAxisID: 'yPrice',
          borderColor: '#d4870a',
          backgroundColor: 'rgba(240, 165, 0, 0.15)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: prices.length > 96 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#d4870a',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          order: 1,
        },
      ],
    };
  });

  // ── Chart options (static) ────────────────────────────────────────────────
  readonly chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeInOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: '#e2e6ed',
        borderWidth: 1,
        titleColor: '#4b5563',
        bodyColor: '#111827',
        padding: 12,
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            const x = items[0]?.parsed.x;
            if (x == null) return '';
            return new Date(x as number).toLocaleString('hr-HR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            });
          },
          label: (item: TooltipItem<'line'>) => {
            const v = item.parsed.y ?? 0;
            return item.dataset.yAxisID === 'ySolar'
              ? `  ☀ ${v.toFixed(3)} kW`
              : `  ⚡ ${v.toFixed(2)} EUR/MWh`;
          },
        },
      },
      zoom: {
        zoom: { drag: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
        pan:  { enabled: true, mode: 'x' },
      },
    } as any,
    scales: {
      x: {
        type: 'time',
        time: { tooltipFormat: 'dd.MM.yyyy HH:mm' },
        grid:   { color: 'rgba(226, 230, 237, 0.8)', drawTicks: false },
        border: { color: '#e2e6ed' },
        ticks: {
          color: '#4b5563',
          font:  { family: "'JetBrains Mono'", size: 11 },
          maxTicksLimit: 12,
          maxRotation: 0,
        },
      },
      ySolar: {
        type: 'linear',
        position: 'left',
        display: 'auto',
        beginAtZero: true,
        grid:   { color: 'rgba(0, 153, 187, 0.08)', drawTicks: false },
        border: { color: 'rgba(0,153,187,0.3)', dash: [4, 4] },
        ticks: {
          color: '#0099bb',
          font:  { family: "'JetBrains Mono'", size: 11 },
          callback: (v) => `${v} kW`,
        },
        title: {
          display: true, text: 'AC POWER', color: '#0099bb',
          font: { family: "'JetBrains Mono'", size: 9 },
          padding: { bottom: 4 },
        },
      },
      yPrice: {
        type: 'linear',
        position: 'right',
        display: 'auto',
        grid:   { color: 'rgba(226, 230, 237, 0.8)', drawTicks: false },
        border: { color: '#e2e6ed', dash: [4, 4] },
        ticks: {
          color: '#4b5563',
          font:  { family: "'JetBrains Mono'", size: 11 },
          callback: (v) => `${v} €`,
        },
        title: {
          display: true, text: 'EUR/MWh', color: '#d4870a',
          font: { family: "'JetBrains Mono'", size: 9 },
          padding: { bottom: 4 },
        },
      },
    },
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const { from, to } = this.initialDateRange();
    this.fromDate = this.toInputValue(from);
    this.toDate   = this.toInputValue(to);
    this.fetch();
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  fetch(): void {
    const from = new Date(this.fromDate);
    const to   = new Date(this.toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
      this.error.set('Invalid date range.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.solarError.set(null);

    const priceReq = this.priceService.fetchDayAheadPrices(from, to);

    const solarReq = this.solarService.fetchForecast({
      lat:        this.solarLat,
      lon:        this.solarLon,
      capacityKw: this.solarCapacityKw,
      tilt:       this.solarTilt,
      azimuth:    this.solarAzimuth,
      efficiency: this.solarEfficiency / 100,
      losses:     this.solarLosses     / 100,
    }).pipe(catchError(err => {
      this.solarError.set(err?.message ?? 'Solar forecast unavailable — is the backend running?');
      return of([] as SolarForecastPoint[]);
    }));

    forkJoin({ prices: priceReq, solar: solarReq }).subscribe({
      next: ({ prices, solar }) => {
        this.prices.set(prices);
        this.solarForecast.set(solar);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to fetch prices. Is the backend running?');
        this.loading.set(false);
      },
    });
  }

  fetchSolar(): void {
    this.solarError.set(null);
    this.solarService.fetchForecast({
      lat:        this.solarLat,
      lon:        this.solarLon,
      capacityKw: this.solarCapacityKw,
      tilt:       this.solarTilt,
      azimuth:    this.solarAzimuth,
      efficiency: this.solarEfficiency / 100,
      losses:     this.solarLosses     / 100,
    }).pipe(catchError(err => {
      this.solarError.set(err?.message ?? 'Solar forecast unavailable.');
      return of([] as SolarForecastPoint[]);
    })).subscribe(solar => this.solarForecast.set(solar));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private initialDateRange(): { from: Date; to: Date } {
    const now = new Date();
    const offset = now.getUTCHours() >= 16 ? 1 : 0;
    const utcDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
    const from = new Date(utcDay.getUTCFullYear(), utcDay.getUTCMonth(), utcDay.getUTCDate(), 0, 0);
    const to   = new Date(utcDay.getUTCFullYear(), utcDay.getUTCMonth(), utcDay.getUTCDate(), 23, 59);
    return { from, to };
  }

  private toInputValue(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
