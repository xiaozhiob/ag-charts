import { AgEnterpriseCharts, AgChartOptions } from 'ag-charts-enterprise';
import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    title: {
        text: `Night & Gale Inc revenue`,
    },
    subtitle: {
        text: 'in million U.S. dollars',
    },
    series: [
        {
            type: 'radial-column',
            angleKey: 'quarter',
            radiusKey: 'air',
            radiusName: 'Turbines',
        },
        {
            type: 'radial-column',
            angleKey: 'quarter',
            radiusKey: 'winds',
            radiusName: 'Compressors',
        },
        {
            type: 'radial-column',
            angleKey: 'quarter',
            radiusKey: 'holes',
            radiusName: 'Smoke Detectors',
        },
    ],
    axes: [
        {
            type: 'angle-category',
            label: {
                orientation: 'parallel',
            },
        },
        {
            type: 'radius-number',
        },
    ],
};

AgEnterpriseCharts.create(options);
