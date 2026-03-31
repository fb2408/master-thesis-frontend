import {
  Component, Input, OnChanges, SimpleChanges,
  AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DayAheadPricePoint } from '../../../../core/models/day-ahead-price.model';
import {
  Chart, ChartConfiguration, LineController, LineElement,
  PointElement, LinearScale, TimeScale, Tooltip, Filler, ChartData,
  TooltipItem
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler, zoomPlugin);

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
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private platformId = inject(PLATFORM_ID);

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.buildChart();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['prices'] && this.chart) {
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
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(240, 165, 0, 0.25)');
    gradient.addColorStop(0.6, 'rgba(240, 165, 0, 0.05)');
    gradient.addColorStop(1, 'rgba(240, 165, 0, 0)');

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: this.buildData(gradient),
      options: {
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
                const x = items[0].parsed.x;
                if (x == null) return '';
                const d = new Date(x as number);
                return d.toLocaleString('hr-HR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                });
              },
              label: (item: TooltipItem<'line'>) => `  ${(item.parsed.y ?? 0).toFixed(2)} EUR/MWh`
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
          y: {
            position: 'right',
            grid: { color: 'rgba(226, 230, 237, 0.8)', drawTicks: false },
            border: { color: '#e2e6ed', dash: [4, 4] },
            ticks: {
              color: '#4b5563',
              font: { family: "'JetBrains Mono'", size: 11 },
              callback: (v) => `${v} €`
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
    if (this.prices.length) this.updateChart();
  }

  private buildData(gradient: CanvasGradient): ChartData<'line'> {
    const points = this.prices.map(p => ({ x: new Date(p.timeStart + 'Z').getTime(), y: p.price }));
    return {
      datasets: [{
        data: points,
        borderColor: '#d4870a',
        borderWidth: 2,
        backgroundColor: gradient,
        fill: true,
        pointRadius: points.length > 96 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#d4870a',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        tension: 0.3
      }]
    };
  }

  private updateChart(): void {
    if (!this.chart) return;
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(240, 165, 0, 0.25)');
    gradient.addColorStop(0.6, 'rgba(240, 165, 0, 0.05)');
    gradient.addColorStop(1, 'rgba(240, 165, 0, 0)');

    const data = this.buildData(gradient);
    this.chart.data = data;
    this.chart.resetZoom();
    this.chart.update('active');
  }
}
