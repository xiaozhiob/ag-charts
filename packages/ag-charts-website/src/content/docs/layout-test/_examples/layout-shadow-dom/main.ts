// @ag-skip-fws
import { AgCartesianChartOptions, AgCharts } from 'ag-charts-community';

const container = document.createElement('div');

const shadowContainer = document.getElementById('myChartComponent');
shadowContainer?.attachShadow({ mode: 'open' });
shadowContainer?.shadowRoot?.appendChild(container);

// Chart Options
const options: AgCartesianChartOptions = {
    container,
    data: [
        { month: 'Jan', avgTemp: 2.3, iceCreamSales: 162000 },
        { month: 'Mar', avgTemp: 6.3, iceCreamSales: 302000 },
        { month: 'May', avgTemp: 16.2, iceCreamSales: 800000 },
        { month: 'Jul', avgTemp: 22.8, iceCreamSales: 1254000 },
        { month: 'Sep', avgTemp: 14.5, iceCreamSales: 950000 },
        { month: 'Nov', avgTemp: 8.9, iceCreamSales: 200000 },
    ],
    // Series: Defines which chart type and data to use
    series: [
        { type: 'bar', xKey: 'month', yKey: 'iceCreamSales' },
        { type: 'line', xKey: 'month', yKey: 'avgTemp' },
    ],
    axes: [
        { type: 'category', position: 'bottom' },
        { type: 'number', position: 'left', keys: ['iceCreamSales'] },
        { type: 'number', position: 'right', keys: ['avgTemp'] },
    ],
};

AgCharts.create(options);
