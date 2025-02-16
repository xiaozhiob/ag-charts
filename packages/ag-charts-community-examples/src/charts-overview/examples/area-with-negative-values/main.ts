import type { AgChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-community"
import { getData } from "./data"

const options: AgChartOptions = {
  container: document.getElementById("myChart"),
  data: getData(),
  theme: {
    palette: {
      fills: ["#FA7921", "#5BC0EB", "#9BC53D", "#E55934", "#FDE74C"],
      strokes: ["#af5517", "#4086a4", "#6c8a2b", "#a03e24", "#b1a235"],
    },
    overrides: {
      area: {
        series: {
          fillOpacity: 0.6,
          highlightStyle: {
            series: {
              strokeWidth: 3,
              dimOpacity: 0.1,
            },
          },
        },
      },
    },
  },
  title: {
    text: "Changes in UK Energy Stock",
    fontSize: 18,
    spacing: 25,
  },
  footnote: {
    text: "Source: Department for Business, Energy & Industrial Strategy",
  },
  series: [
    {
      type: "area",
      xKey: "quarter",
      yKey: "naturalGas",
      yName: "Natural gas",
    },
    {
      type: "area",
      xKey: "quarter",
      yKey: "coal",
      yName: "Coal",
    },
    {
      type: "area",
      xKey: "quarter",
      yKey: "primaryOil",
      yName: "Primary oil",
    },
    {
      type: "area",
      xKey: "quarter",
      yKey: "petroleum",
      yName: "Petroleum",
    },
    {
      type: "area",
      xKey: "quarter",
      yKey: "manufacturedFuels",
      yName: "Manufactured fuels",
    },
  ],
  axes: [
    {
      type: "category",
      position: "bottom",
    },
    {
      type: "number",
      position: "left",
      title: {
        text: "Thousand tonnes of oil equivalent",
      },
    },
  ],
}

const chart = AgCharts.create(options)
