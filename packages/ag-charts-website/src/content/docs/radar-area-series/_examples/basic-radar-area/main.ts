import { AgEnterpriseCharts, AgChartOptions } from 'ag-charts-enterprise';
import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    title: {
        text: 'School Grades',
    },
    series: [
        {
            type: 'radar-area',
            angleKey: 'subject',
            radiusKey: 'grades',
            radiusName: `Grades`,
        },
    ],
    legend: {
        enabled: true,
    },
};

const chart = AgEnterpriseCharts.create(options);
