import { AgEnterpriseCharts, AgChartOptions } from 'ag-charts-enterprise';
import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    title: {
        text: 'SOCIAL CIRCLE',
    },
    series: Object.entries(getData()).map(([relationship, data]) => ({
        data,
        type: 'radar-line',
        angleKey: 'recognitionTime',
        angleName: 'Recognition Time',
        radiusKey: 'closeness',
        radiusName: `${relationship
            .split(' ')
            .map((word) => `${word[0].toUpperCase()}${word.substring(1)}`)
            .join(' ')}`,
        strokeWidth: 0,
        marker: {
            fillOpacity: 0.8,
        },
    })),
    axes: [
        {
            type: 'angle-number',
            shape: 'circle',
            gridLine: {
                enabled: false,
            },
            line: {
                width: 0,
            },
        },
        {
            type: 'radius-number',
            shape: 'circle',
            label: {
                enabled: false,
            },
            gridLine: {
                enabled: false,
            },
            crossLines: [
                {
                    type: 'line',
                    value: 1,
                    strokeWidth: 1,
                    strokeOpacity: 0.5,
                    label: {
                        text: 'INTIMATE',
                        padding: -30,
                    },
                },
                {
                    type: 'line',
                    value: 2,
                    strokeWidth: 1,
                    strokeOpacity: 0.5,
                    label: {
                        text: 'BEST FRIENDS',
                        padding: -30,
                    },
                },
                {
                    type: 'line',
                    value: 6,
                    strokeWidth: 1,
                    strokeOpacity: 0.5,
                    label: {
                        text: 'FRIENDS',
                        padding: -30,
                    },
                },
                {
                    type: 'line',
                    value: 10,
                    strokeWidth: 0,
                    label: {
                        text: 'ACQUAINTANCES',
                        padding: -30,
                    },
                },
            ],
        },
    ],
};

AgEnterpriseCharts.create(options);
