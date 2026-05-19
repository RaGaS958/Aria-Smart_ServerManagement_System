/**
 * MetricsChart — live rolling chart driven by Zustand store.
 * Does NOT use chartjs-plugin-streaming (incompatible with chart.js v4).
 * Reads history from store and redraws on every websocket tick.
 */
import { useEffect, useRef } from 'react'
import {
  Chart,
  LineController, LineElement, PointElement,
  LinearScale, CategoryScale,
  Filler, Tooltip, Legend,
} from 'chart.js'
import { useServerStore } from '../../store/index.js'

Chart.register(
  LineController, LineElement, PointElement,
  LinearScale, CategoryScale,
  Filler, Tooltip, Legend,
)

const NODE_COLORS = {
  R1: { line: '#38bdf8', fill: 'rgba(56,189,248,0.12)'  },
  R2: { line: '#4ade80', fill: 'rgba(74,222,128,0.12)'  },
  R3: { line: '#c084fc', fill: 'rgba(192,132,252,0.12)' },
}
const UNITS = { cpu: '%', ram: '%', temp: '°C' }
const MAX_PTS = 30

export default function MetricsChart({ metric = 'cpu', height = 120 }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  const history   = useServerStore(s => s.history)

  // Create chart once on mount
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(MAX_PTS).fill(''),
        datasets: ['R1', 'R2', 'R3'].map(nid => ({
          label: nid,
          data: Array(MAX_PTS).fill(null),
          borderColor: NODE_COLORS[nid].line,
          backgroundColor: NODE_COLORS[nid].fill,
          borderWidth: 1.5,
          pointRadius: 0,
          fill: metric === 'cpu',
          tension: 0.4,
        })),
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: 'rgba(56,189,248,0.7)',
              font: { size: 9, family: 'monospace' },
              boxWidth: 8, padding: 8,
            },
          },
          tooltip: {
            backgroundColor: '#0b161e',
            borderColor: 'rgba(56,189,248,0.3)',
            borderWidth: 1,
            titleColor: '#38bdf8',
            bodyColor: '#94a3b8',
            callbacks: {
              title: () => '',
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? '--'}${UNITS[metric] ?? ''}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { display: false },
            grid:  { color: 'rgba(56,189,248,0.06)' },
            border:{ display: false },
          },
          y: {
            min: metric === 'temp' ? 20 : 0,
            max: metric === 'temp' ? 100 : 100,
            ticks: {
              color: 'rgba(56,189,248,0.45)',
              font: { size: 9, family: 'monospace' },
              maxTicksLimit: 4,
              callback: v => v + (metric === 'temp' ? '°' : '%'),
            },
            grid:  { color: 'rgba(56,189,248,0.06)' },
            border:{ display: false },
          },
        },
      },
    })
    return () => { chartRef.current?.destroy() }
  }, [metric])

  // Push new data whenever store history updates
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.data.datasets.forEach((ds, i) => {
      const nid = ['R1','R2','R3'][i]
      const pts = history[nid]?.[metric] ?? []
      const slice = pts.slice(-MAX_PTS)
      ds.data = [
        ...Array(Math.max(0, MAX_PTS - slice.length)).fill(null),
        ...slice.map(p => p.y),
      ]
    })
    chart.update('none')
  }, [history, metric])

  return (
    <div style={{ height, position: 'relative', width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  )
}