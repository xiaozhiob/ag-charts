import { AgCartesianChartOptions, AgChartOptions, AgCharts } from 'ag-charts-enterprise';

import { costsProductA, costsProductB, salesProductA, salesProductB } from './data';

const commonOptions: AgCartesianChartOptions = {
    minWidth: 0,
    minHeight: 0,
    tooltip: {
        enabled: false,
    },
    zoom: {
        enabled: true,
    },
};

const topChartAxis: AgCartesianChartOptions = {
    axes: [
        {
            type: 'number',
            position: 'left',
        },
        {
            type: 'category',
            position: 'bottom',
            label: { enabled: false },
            line: { enabled: false },
            crosshair: {
                enabled: true,
                label: { enabled: false },
            },
        },
    ],
};

const bottomChartAxis: AgCartesianChartOptions = {
    axes: [
        {
            type: 'number',
            position: 'left',
        },
        {
            type: 'category',
            position: 'bottom',
            label: { autoRotate: false },
            crosshair: { enabled: true },
        },
    ],
};

const chartOptions1: AgChartOptions = {
    ...commonOptions,
    ...topChartAxis,
    container: document.getElementById('myChart1'),
    sync: {
        enabled: true,
        groupId: 'sales',
    },
    title: { text: 'Sales' },
    subtitle: { text: 'Product A', textAlign: 'left' },
    data: salesProductA,
    padding: { bottom: 5 },
    series: [
        {
            type: 'line',
            xKey: 'quarter',
            yKey: 'sales',
        },
    ],
};

AgCharts.create(chartOptions1);

const chartOptions2: AgChartOptions = {
    ...commonOptions,
    ...topChartAxis,
    container: document.getElementById('myChart2'),
    sync: {
        enabled: true,
        groupId: 'costs',
    },
    title: { text: 'Costs' },
    subtitle: { text: 'Product A', textAlign: 'left' },
    data: costsProductA,
    series: [
        {
            type: 'line',
            xKey: 'quarter',
            yKey: 'costs',
        },
    ],
};

AgCharts.create(chartOptions2);

const chartOptions3: AgChartOptions = {
    ...commonOptions,
    ...bottomChartAxis,
    container: document.getElementById('myChart3'),
    sync: {
        enabled: true,
        groupId: 'sales',
    },
    subtitle: { text: 'Product B', textAlign: 'left' },
    data: salesProductB,
    series: [
        {
            type: 'line',
            xKey: 'quarter',
            yKey: 'sales',
        },
    ],
};

AgCharts.create(chartOptions3);

const chartOptions4: AgChartOptions = {
    ...commonOptions,
    ...bottomChartAxis,
    container: document.getElementById('myChart4'),
    sync: { enabled: true, groupId: 'costs' },
    subtitle: { text: 'Product B', textAlign: 'left' },
    data: costsProductB,
    series: [
        {
            type: 'line',
            xKey: 'quarter',
            yKey: 'efficiency',
        },
    ],
};

AgCharts.create(chartOptions4);
