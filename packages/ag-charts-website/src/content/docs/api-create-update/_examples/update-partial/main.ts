import {
    AgAreaSeriesOptions,
    AgChartLegendPosition,
    AgChartOptions,
    AgChartTheme,
    AgCharts,
} from 'ag-charts-community';

import { getData } from './data';

function buildSeries(name: string): AgAreaSeriesOptions {
    return {
        type: 'area',
        xKey: 'year',
        yKey: name.toLowerCase(),
        yName: name,
        fillOpacity: 0.5,
    };
}

const series = [buildSeries('IE'), buildSeries('Chrome'), buildSeries('Firefox'), buildSeries('Safari')];

const positions: AgChartLegendPosition[] = ['left', 'top', 'right', 'bottom'];
const legend = {
    position: positions[1],
};

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    title: {
        text: 'Browser Usage Statistics',
    },
    subtitle: {
        text: '2009-2019',
    },
    data: getData(),
    series,
    legend,
};

const chart = AgCharts.create(options);

function reverseSeries() {
    const series = chart.getOptions().series as AgAreaSeriesOptions[];
    series!.reverse();

    chart.updateDelta({ series });
}

function swapTitles() {
    const { title, subtitle } = chart.getOptions();

    chart.updateDelta({ title: subtitle, subtitle: title });
}

function rotateLegend() {
    const position = chart.getOptions().legend!.position;

    const currentIdx = positions.indexOf(position ?? 'top');
    const newPosition = positions[(currentIdx + 1) % positions.length];

    chart.updateDelta({ legend: { position: newPosition } });
}

function changeTheme() {
    const theme = chart.getOptions()?.theme as AgChartTheme;
    const markersEnabled = theme?.overrides?.area?.series?.marker?.enabled ?? false;
    chart.updateDelta({
        theme: { overrides: { area: { series: { marker: { enabled: !markersEnabled } } } } },
    });
}
