import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EnergyPricesService } from '../../core/services/energy-prices.service';
import { SolarForecastService } from '../../core/services/solar-forecast.service';
import { DayAheadPricePoint, PriceStats } from '../../core/models/day-ahead-price.model';
import { SolarForecastPoint } from '../../core/models/solar-forecast.model';
import { PriceChartComponent } from './components/price-chart/price-chart.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, PriceChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly priceService = inject(EnergyPricesService);
  private readonly solarService = inject(SolarForecastService);

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
  solarCapacityKw = 10.0;
  solarTilt       = 30;
  solarAzimuth    = 180;
  solarEfficiency = 20;   // entered as %
  solarLosses     = 14;   // entered as %

  // ── Derived: price stats ─────────────────────────────────────────────────
  stats = computed<PriceStats | null>(() => {
    const pts = this.prices();
    if (!pts.length) return null;
    const vals = pts.map(p => p.price);
    const now = new Date();
    const current = pts.find(p => {
      const t = new Date(p.timeStart + 'Z');
      return Math.abs(t.getTime() - now.getTime()) < 30 * 60 * 1000;
    });
    return {
      min:      Math.min(...vals),
      max:      Math.max(...vals),
      avg:      vals.reduce((a, b) => a + b, 0) / vals.length,
      current:  current?.price ?? null,
      currency: pts[0]?.currency ?? 'EUR'
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
      }
    });
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
