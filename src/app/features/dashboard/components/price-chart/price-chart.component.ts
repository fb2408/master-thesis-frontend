import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  OnDestroy, afterRenderEffect, input, viewChild,
} from '@angular/core';
import { ChartData, ChartOptions, Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler, Legend } from 'chart.js';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import { VerticalLineHover } from './vertical-line-hover.plugin';

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
  styleUrl: './price-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceChartComponent implements AfterViewInit, OnDestroy {
  readonly data    = input.required<ChartData<'line'>>();
  readonly options = input.required<ChartOptions<'line'>>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');

  chart?: Chart;

  constructor() {
    afterRenderEffect({
      write: () => {
        const data = this.data();
        if (!this.chart) return;
        this.chart.data = data;
        this.chart.update();
      },
    });
  }

  ngAfterViewInit(): void {
    const ctx = this.canvasRef().nativeElement.getContext('2d')!;
    this.chart = new Chart(ctx, {
      type: 'line',
      data: this.data(),
      options: this.options(),
      plugins: [VerticalLineHover],
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  resetZoom(): void {
    this.chart?.resetZoom();
  }
}
