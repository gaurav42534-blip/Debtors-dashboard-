'use client'

import styles from './TrendChart.module.css'

interface DataPoint {
  label: string
  value: number
}

interface TrendChartProps {
  data: DataPoint[]
  title: string
}

export default function TrendChart({ data, title }: TrendChartProps) {
  if (data.length < 2) {
    return (
      <div className={styles.empty}>
        <p>Not enough data to display a trend yet. Keep adding transactions!</p>
      </div>
    )
  }

  const maxValue = Math.max(...data.map(d => d.value), 1)
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const width = 600
  const height = 250
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.value / maxValue) * chartH,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`

  // Generate Y-axis labels (4 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(frac => ({
    value: Math.round(maxValue * frac),
    y: padding.top + chartH - frac * chartH,
  }))

  const formatValue = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`
    return `₹${val}`
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.chartContainer}>
        <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={tick.y}
              x2={width - padding.right}
              y2={tick.y}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}

          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGrad)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--surface)" stroke="var(--gold)" strokeWidth="2" />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick, i) => (
            <text key={i} x={padding.left - 8} y={tick.y + 4} textAnchor="end" fill="var(--text-tertiary)" fontSize="11" fontFamily="var(--font-sans)">
              {formatValue(tick.value)}
            </text>
          ))}

          {/* X-axis labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={points[i].x}
              y={height - 8}
              textAnchor="middle"
              fill="var(--text-tertiary)"
              fontSize="11"
              fontFamily="var(--font-sans)"
            >
              {d.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
