<template>
  <div ref="box" :style="{ width: '100%', height }"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import echarts from '@/utils/echarts'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '300px' }
})

const box = ref(null)
let chart = null

function render() {
  if (!chart) return
  chart.setOption(props.option, true)
}

function resize() {
  if (chart) chart.resize()
}

onMounted(() => {
  chart = echarts.init(box.value)
  render()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  if (chart) chart.dispose()
  chart = null
})

watch(() => props.option, render, { deep: true })
</script>
