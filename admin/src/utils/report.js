/** 工单状态码全部清单，与后端 status 取值保持一致 */
export const REPORT_STATUSES = ['待审核', '待派单', '已派单', '处理中', '已完成', '已驳回', '已取消']

const STATUS_COLOR = {
  待审核: 'orange',
  待派单: 'gold',
  已派单: 'blue',
  处理中: 'cyan',
  已完成: 'green',
  已驳回: 'red',
  已取消: 'default'
}

export const statusColor = (s) => STATUS_COLOR[s] || 'default'

/** 状态对应的图表颜色，保证各模块配色统一 */
const STATUS_CHART_COLOR = {
  待审核: '#faad14',
  待派单: '#f6bd16',
  已派单: '#3b9dff',
  处理中: '#178cba',
  已完成: '#20c7a5',
  已驳回: '#ff7875',
  已取消: '#7a879b'
}

export const statusChartColor = (s) => STATUS_CHART_COLOR[s] || '#8c9ab2'
