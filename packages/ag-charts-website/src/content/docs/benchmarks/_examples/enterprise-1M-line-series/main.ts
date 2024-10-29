import { AgChartOptions, AgCharts } from 'ag-charts-enterprise';

import { getData } from './data';

(window as any).agChartsDebug = 'scene:stats';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    animation: { enabled: false },
    zoom: {
        enabled: true,
        anchorPointX: 'pointer',
        anchorPointY: 'pointer',
    },
    navigator: {
        enabled: true,
    },
    series: [
        {
            type: 'line',
            xKey: 'timestamp',
            yKey: 'price',
            marker: { enabled: false },
        },
    ],
    axes: [{ type: 'number' }, { type: 'time', nice: false }],
};

AgCharts.create(options);
