import type { AgChartOptions } from 'ag-charts-community';
import { AgCharts } from 'ag-charts-community';

import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    title: {
        text: 'Punch Card of Github',
        fontSize: 18,
    },
    subtitle: {
        text: 'time distribution of commits',
    },
    series: [
        {
            type: 'bubble',
            xKey: 'hour',
            xName: 'Time',
            yKey: 'day',
            yName: 'Day',
            sizeKey: 'size',
            sizeName: 'Commits',
            title: 'Punch Card',
            size: 0,
            maxSize: 30,
            fill: '#cc5b58',
            fillOpacity: 0.85,
            strokeOpacity: 0.85,
        },
    ],
    axes: [
        {
            position: 'bottom',
            type: 'category',
            gridLine: {
                style: [
                    {
                        stroke: 'rgba(0,0,0,0.2)',
                        lineDash: [0, 5, 0],
                    },
                ],
            },
            paddingInner: 0.2,
            paddingOuter: 0.3,
            tick: {
                stroke: 'black',
            },
            label: {
                padding: 5,
            },
            line: {
                stroke: 'transparent',
            },
        },
        {
            position: 'left',
            type: 'category',
            gridLine: {
                style: [],
            },
            paddingInner: 0.2,
            paddingOuter: 0.3,
            tick: {
                stroke: 'black',
            },
            label: {
                padding: 5,
            },
            line: {
                stroke: 'transparent',
            },
        },
    ],
};

const chart = AgCharts.create(options);
