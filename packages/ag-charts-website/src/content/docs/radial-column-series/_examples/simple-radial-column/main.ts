import { AgChartOptions, AgEnterpriseCharts } from 'ag-charts-enterprise';

import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    title: {
        text: 'Revenue by Product Category',
    },
    subtitle: {
        text: 'Millions USD',
    },
    series: [
        {
            type: 'radial-column',
            angleKey: 'quarter',
            radiusKey: 'software',
            radiusName: 'Software',
        },
        {
            type: 'radial-column',
            angleKey: 'quarter',
            radiusKey: 'hardware',
            radiusName: 'Hardware',
        },
        {
            type: 'radial-column',
            angleKey: 'quarter',
            radiusKey: 'services',
            radiusName: 'Services',
        },
    ],
};

AgEnterpriseCharts.create(options);
