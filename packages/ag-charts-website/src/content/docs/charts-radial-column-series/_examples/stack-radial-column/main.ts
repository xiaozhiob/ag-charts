import { AgEnterpriseCharts, AgChartOptions } from 'ag-charts-enterprise';
import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    title: {
        text: `Night & Gale Inc revenue by product category`,
    },
    subtitle: {
        text: 'in million U.S. dollars',
    },
    series: [
        {
            type: 'radial-column',
            angleKey: 'quarter',
            radiusKey: 'air',
            radiusName: 'Mountain air',
            stacked: true,
        },
        {
            type: 'radial-column',
            angleKey: 'quarter',
            radiusKey: 'winds',
            radiusName: 'Polar winds',
            stacked: true,
        },
        {
            type: 'radial-column',
            angleKey: 'quarter',
            radiusKey: 'holes',
            radiusName: 'Donut holes',
            stacked: true,
        },
    ],
};

const chart = AgEnterpriseCharts.create(options);
