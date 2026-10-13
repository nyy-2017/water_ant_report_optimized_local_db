<template>
  <a-config-provider :theme="themeConfig" :locale="zhCN">
    <router-view />
  </a-config-provider>
</template>

<script setup>
import { theme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const themeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#20c7a5',
    colorSuccess: '#20c7a5',
    colorInfo: '#3b9dff',
    colorWarning: '#faad14',
    colorError: '#ff7875',
    colorBgBase: '#0b1220',
    colorBgContainer: '#122032',
    colorBgElevated: '#16253c',
    colorBorder: '#24374f',
    borderRadius: 8,
    fontSize: 14
  },
  components: {
    Layout: {
      bodyBg: '#0b1220',
      // headerBg / siderBg 用 CSS 覆盖，避免 antd 默认抽屉色与整体不一致
      siderBg: '#0e1729',
      headerBg: '#0e1729',
      headerHeight: 56,
      headerPadding: '0 16px'
    },
    Menu: { darkItemBg: '#0e1729', darkSubMenuItemBg: '#0b1424' },
    Card: { colorBgContainer: '#122032' },
    Table: { headerBg: '#16253c', headerSplitColor: '#24374f' }
  }
}
</script>
