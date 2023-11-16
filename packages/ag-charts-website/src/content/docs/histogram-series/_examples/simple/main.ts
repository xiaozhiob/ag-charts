import { AgChartOptions, AgCharts } from 'ag-charts-community';

import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    title: {
        text: 'Race demographics',
    },
    data: getData(),
    series: [
        {
            type: 'histogram',
            xKey: 'age',
            xName: 'Participant Age',
        },
    ],
    axes: [
        {
            type: 'number',
            position: 'bottom',
            title: { text: 'Age band (years)' },
            tick: { interval: 2 },
        },
        {
            type: 'number',
            position: 'left',
            title: { text: 'Number of participants' },
        },
    ],
};

AgCharts.create(options);
