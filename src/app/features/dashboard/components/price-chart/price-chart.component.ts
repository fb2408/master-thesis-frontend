import {
  Component, Input, OnChanges, SimpleChanges,
  AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DayAheadPricePoint } from '../../../../core/models/day-ahead-price.model';
import { SolarForecastPoint } from '../../../../core/models/solar-forecast.model';
import {
  Chart, ChartConfiguration, LineController, LineElement,
  PointElement, LinearScale, TimeScale, Tooltip, Filler, Legend,
  TooltipItem
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler, Legend, zoomPlugin);

@Component({
  selector: 'app-price-chart',
  standalone: true,
  template: `
    <div class="chart-wrapper">
      <canvas #chartCanvas></canvas>
      <button class="reset-zoom-btn" (click)="resetZoom()">Reset zoom</button>
      <div class="chart-hint">Click & drag to zoom</div>
    </div>
  `,
  styleUrl: './price-chart.component.scss'
})
export class PriceChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() prices: DayAheadPricePoint[] = [];
  @Input() solarForecast: SolarForecastPoint[] = [];

  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private platformId = inject(PLATFORM_ID);

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.buildChart();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['prices'] || changes['solarForecast']) && this.chart) {
      this.updateChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  resetZoom(): void {
    this.chart?.resetZoom();
  }

  private buildChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: { datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: false, // driven by chart-legend in the template via updateLegend()
          },
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
                  hour: '2-digit', minute: '2-digit'
                });
              },
              label: (item: TooltipItem<'line'>) => {
                const v = item.parsed.y ?? 0;
                return item.dataset.yAxisID === 'ySolar'
                  ? `  ☀ ${v.toFixed(3)} kW`
                  : `  ⚡ ${v.toFixed(2)} EUR/MWh`;
              }
            }
          },
          zoom: {
            zoom: { drag: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
            pan:  { enabled: true, mode: 'x' }
          }
        } as any,
        scales: {
          x: {
            type: 'time',
            time: { tooltipFormat: 'dd.MM.yyyy HH:mm' },
            grid: { color: 'rgba(226, 230, 237, 0.8)', drawTicks: false },
            border: { color: '#e2e6ed' },
            ticks: {
              color: '#4b5563',
              font: { family: "'JetBrains Mono'", size: 11 },
              maxTicksLimit: 12,
              maxRotation: 0
            }
          },
          ySolar: {
            type: 'linear',
            position: 'left',
            display: 'auto',
            beginAtZero: true,
            grid: { color: 'rgba(0, 153, 187, 0.08)', drawTicks: false },
            border: { color: 'rgba(0,153,187,0.3)', dash: [4, 4] },
            ticks: {
              color: '#0099bb',
              font: { family: "'JetBrains Mono'", size: 11 },
              callback: (v) => `${v} kW`
            },
            title: {
              display: true,
              text: 'AC POWER',
              color: '#0099bb',
              font: { family: "'JetBrains Mono'", size: 9 },
              padding: { bottom: 4 }
            }
          },
          yPrice: {
            type: 'linear',
            position: 'right',
            display: 'auto',
            grid: { color: 'rgba(226, 230, 237, 0.8)', drawTicks: false },
            border: { color: '#e2e6ed', dash: [4, 4] },
            ticks: {
              color: '#4b5563',
              font: { family: "'JetBrains Mono'", size: 11 },
              callback: (v) => `${v} €`
            },
            title: {
              display: true,
              text: 'EUR/MWh',
              color: '#d4870a',
              font: { family: "'JetBrains Mono'", size: 9 },
              padding: { bottom: 4 }
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
    this.updateChart();
  }

  private updateChart(): void {
    if (!this.chart) return;
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;

    // ── Price dataset ──
    const priceGradient = ctx.createLinearGradient(0, 0, 0, 400);
    priceGradient.addColorStop(0,   'rgba(240, 165, 0, 0.22)');
    priceGradient.addColorStop(0.6, 'rgba(240, 165, 0, 0.04)');
    priceGradient.addColorStop(1,   'rgba(240, 165, 0, 0)');

    const pricePoints = this.prices.map(p => ({
      x: new Date(p.timeStart + 'Z').getTime(),
      y: p.price
    }));

    // ── Solar dataset (downsample to hourly for performance) ──
    const solarGradient = ctx.createLinearGradient(0, 0, 0, 400);
    solarGradient.addColorStop(0,   'rgba(0, 153, 187, 0.20)');
    solarGradient.addColorStop(0.6, 'rgba(0, 153, 187, 0.04)');
    solarGradient.addColorStop(1,   'rgba(0, 153, 187, 0)');

    const solarPoints = this.solarForecast
      .filter((_, i) => i % 4 === 0)   // one point per hour
      .map(p => ({ x: p.ts, y: p.inverterAcPower }));

    this.chart.data.datasets = [
      {
        label: 'Solar AC Power (kW)',
        data: solarPoints,
        yAxisID: 'ySolar',
        borderColor: '#0099bb',
        backgroundColor: solarGradient,
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: '#0099bb',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        tension: 0.4,
        order: 2,
      },
      {
        label: 'Day-ahead Price (EUR/MWh)',
        data: pricePoints,
        yAxisID: 'yPrice',
        borderColor: '#d4870a',
        backgroundColor: priceGradient,
        borderWidth: 2,
        fill: true,
        pointRadius: pricePoints.length > 96 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#d4870a',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        tension: 0.3,
        order: 1,
      },
    ];

    this.chart.resetZoom();
    this.chart.update('active');
  }
}
