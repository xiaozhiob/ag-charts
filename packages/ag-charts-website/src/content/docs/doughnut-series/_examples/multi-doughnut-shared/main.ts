import { AgChart, AgChartOptions } from 'ag-charts-community';

import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    title: {
        text: 'Portfolio Composition',
    },
    subtitle: {
        text: 'Versus Previous Year',
    },
    series: [
        {
            type: 'pie',
            title: {
                text: 'Previous Year',
            },
            calloutLabelKey: 'asset',
            legendItemKey: 'asset',
            angleKey: 'previousYear',
            outerRadiusRatio: 1,
            innerRadiusRatio: 0.9,
        },
        {
            type: 'pie',
            title: {
                text: 'Current Year',
            },
            legendItemKey: 'asset',
            showInLegend: false,
            angleKey: 'currentYear',
            outerRadiusRatio: 0.6,
            innerRadiusRatio: 0.2,
        },
    ],
};

AgChart.create(options);
