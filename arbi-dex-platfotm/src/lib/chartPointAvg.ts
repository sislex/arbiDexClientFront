import type { ChartPoint } from '../services/chartDataService'
import type { NetworkSource } from '../simulation/simulationNetworkTypes'

function midFromPoint(point: ChartPoint, net: NetworkSource): number | null {
  const buy = point[`${net.id}_buy`]
  const sell = point[`${net.id}_sell`]
  if (typeof buy === 'number' && typeof sell === 'number') return (buy + sell) / 2
  if (typeof buy === 'number') return buy
  if (typeof sell === 'number') return sell
  return null
}

export function applyReferenceAverage(
  data: ChartPoint[],
  referenceNets: NetworkSource[],
): ChartPoint[] {
  if (referenceNets.length === 0) return data

  return data.map((point) => {
    const mids: number[] = []
    for (const net of referenceNets) {
      const mid = midFromPoint(point, net)
      if (mid !== null) mids.push(mid)
    }
    if (mids.length === 0) return point
    return {
      ...point,
      avg: +(mids.reduce((a, b) => a + b, 0) / mids.length).toFixed(4),
    }
  })
}
