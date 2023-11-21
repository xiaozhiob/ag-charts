import { AgChartOptions, AgCharts } from 'ag-charts-enterprise';

import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    series: [
        {
            type: 'treemap',
            labelKey: 'title',
            sizeKey: 'total',
        },
    ],
    title: {
        text: 'Organizational Chart',
    },
};

const chart = AgCharts.create(options);

function reset() {
    options.data = getData();
    AgCharts.update(chart, options as any);
}

function randomise() {
    const data = getData();
    const shuffleArray = (array: any[]) => array.sort(() => Math.random() - 0.5);
    const deepShuffle = (node: { children?: any[] }) => {
        if (node.children) {
            shuffleArray(node.children);
            node.children.forEach(deepShuffle);
        }
    };
    shuffleArray(data);
    data.forEach(deepShuffle);

    options.data = data;

    AgCharts.update(chart, options as any);
}
