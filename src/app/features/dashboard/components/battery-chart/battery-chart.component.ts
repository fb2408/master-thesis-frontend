import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  OnDestroy, afterRenderEffect, input, viewChild,
} from '@angular/core';
import { ChartData, ChartOptions, Chart, BarController, BarElement, CategoryScale, LinearScale, TimeScale, Tooltip, Legend, LineController, LineElement, PointElement } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, TimeScale, Tooltip, Legend);

@Component({
  selector: 'app-battery-chart',
  standalone: true,
  template: `
    <div class="chart-wrapper">
      <canvas #chartCanvas></canvas>
    </div>
  `,
  styleUrl: './battery-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BatteryChartComponent implements AfterViewInit, OnDestroy {
  readonly data    = input.required<ChartData>();
  readonly options = input.required<ChartOptions<'bar'>>();

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
      type: 'bar',
      data: this.data() as any,
      options: this.options(),
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
