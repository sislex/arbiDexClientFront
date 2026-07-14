import { useMemo } from 'react'
import { MATRIX_DATA, PAIRS } from '../data/mockData'
import { getHeatmapColor, formatPercent, formatCurrency } from '../lib/utils'
import { Card, CardHeader, CardTitle } from './ui/Card'
import { SortableTableHead } from './ui/SortableTableHead'
import { useTableSort } from '../hooks/useTableSort'
import { cn } from '../lib/utils'

const strategies = Object.keys(MATRIX_DATA)

type MatrixSortKey = 'strategy' | (typeof PAIRS)[number]

function getMatrixRowSortValue(strategy: string, key: MatrixSortKey) {
  if (key === 'strategy') return strategy
  return MATRIX_DATA[strategy]?.[key]?.roi ?? -Infinity
}

function findBestCell() {
  let best = { strategy: '', pair: '', roi: -Infinity }
  for (const strategy of strategies) {
    for (const pair of PAIRS) {
      const cell = MATRIX_DATA[strategy]?.[pair]
      if (cell && cell.roi > best.roi) {
        best = { strategy, pair, roi: cell.roi }
      }
    }
  }
  return best
}

export function StrategyMatrix() {
  const best = findBestCell()
  const { sortKey, direction, toggleSort, sort } = useTableSort<MatrixSortKey>()

  const sortedStrategies = useMemo(
    () => sort(strategies, getMatrixRowSortValue),
    [sort],
  )

  return (
    <div className="space-y-4">
      <Card className="bg-accent-purple/5 border-accent-purple/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-purple/20 flex items-center justify-center text-2xl">🏆</div>
          <div>
            <p className="text-sm text-muted">Best Combination</p>
            <p className="text-lg font-bold text-white">
              {best.strategy} × {best.pair}
              <span className="text-success ml-2">{formatPercent(best.roi)}</span>
            </p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Strategy Effectiveness Matrix</CardTitle>
          <p className="text-xs text-muted">Строки — стратегии, столбцы — торговые пары. Цвет = ROI</p>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <SortableTableHead
                  label="Strategy / Pair"
                  column="strategy"
                  sortKey={sortKey}
                  direction={direction}
                  onSort={(col) => toggleSort(col as MatrixSortKey)}
                  className="px-4 py-3 sticky left-0 bg-card z-10 min-w-[140px]"
                />
                {PAIRS.map((pair) => (
                  <SortableTableHead
                    key={pair}
                    label={pair.split('/')[0]}
                    column={pair}
                    sortKey={sortKey}
                    direction={direction}
                    onSort={(col) => toggleSort(col as MatrixSortKey)}
                    className="px-3 py-3 min-w-[100px]"
                    align="center"
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStrategies.map((strategy) => (
                <tr key={strategy} className="border-b border-border/50">
                  <td className="px-4 py-3 font-medium text-white sticky left-0 bg-card z-10">
                    {strategy}
                  </td>
                  {PAIRS.map((pair) => {
                    const cell = MATRIX_DATA[strategy]?.[pair]
                    if (!cell) return <td key={pair} className="px-3 py-3 text-center text-muted">—</td>
                    const isBest = strategy === best.strategy && pair === best.pair
                    return (
                      <td key={pair} className="px-2 py-2">
                        <div
                          className={cn(
                            'rounded-xl p-2.5 text-center transition-all cursor-default',
                            getHeatmapColor(cell.roi),
                            isBest && 'ring-2 ring-accent-purple ring-offset-1 ring-offset-card',
                          )}
                          title={`Win Rate: ${cell.winRate}% · Profit: ${formatCurrency(cell.profit)}`}
                        >
                          <p className="font-bold text-sm">{formatPercent(cell.roi)}</p>
                          <p className="text-[10px] opacity-70 mt-0.5">{cell.winRate}% WR</p>
                          {isBest && <p className="text-[10px] text-accent-purple font-bold mt-0.5">BEST</p>}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center gap-4 text-xs text-muted">
        <span>ROI Scale:</span>
        <div className="flex items-center gap-1">
          <div className="w-8 h-4 rounded bg-red-500/40" /><span>&lt; -10%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-4 rounded bg-slate-500/15" /><span>0%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-4 rounded bg-emerald-500/25" /><span>8%+</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-4 rounded bg-emerald-500/40" /><span>15%+</span>
        </div>
      </div>
    </div>
  )
}
