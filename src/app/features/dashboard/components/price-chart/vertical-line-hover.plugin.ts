import { Chart, ChartType, Plugin } from 'chart.js';

export const VerticalLineHover: Plugin = {
  id: 'verticalLineHover',
  afterDatasetsDraw(chart: Chart<ChartType>) {
    const ctx = chart.ctx;
    if (!ctx) return;

    chart.getDatasetMeta(0).data.forEach(dataPoint => {
      if (dataPoint.active) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(75, 85, 99, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(dataPoint.x, chart.chartArea.top);
        ctx.lineTo(dataPoint.x, chart.chartArea.bottom);
        ctx.stroke();
        ctx.restore();
      }
    });
  },
};
