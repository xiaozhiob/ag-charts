import { AgChartOptions, AgCharts } from 'ag-charts-enterprise';

import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    title: {
        text: 'Conversion Drop Off',
    },
    series: [
        {
            type: 'funnel',
            xKey: 'group',
            yKey: 'value',
            direction: 'vertical',
        },
    ],
};

AgCharts.create(options);
