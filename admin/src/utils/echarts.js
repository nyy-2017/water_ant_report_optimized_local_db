/** 按需引入 ECharts，避免整包打入产物 */
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  GraphicComponent,
  MarkLineComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  GraphicComponent,
  MarkLineComponent,
  CanvasRenderer
])

export default echarts

/** 统一的暗色图表基础样式 */
export const baseAxis = {
  axisLine: { lineStyle: { color: '#24374f' } },
  axisTick: { show: false },
  axisLabel: { color: '#8c9ab2', fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(36,55,79,0.55)', type: 'dashed' } }
}

export const palette = ['#20c7a5', '#178cba', '#3b9dff', '#7c6cff', '#faad14', '#ff7875', '#36cfc9', '#f759ab']

export const baseTooltip = {
  backgroundColor: 'rgba(18,32,50,0.96)',
  borderColor: '#24374f',
  textStyle: { color: '#e8eef8', fontSize: 12 }
}
