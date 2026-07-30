import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { fetchBotSessions, type ServerBotSession } from '../../services/botsApi'
import { fmtDurationMs, fmtSessionTime, fmtSigned, sessionModeLabel } from '../../lib/botFormatters'

interface BotSessionsTabProps {
  botId: string
  refreshKey?: number
}

export function BotSessionsTab({ botId, refreshKey = 0 }: BotSessionsTabProps) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ServerBotSession[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchBotSessions(botId)
        .then((rows) => {
          if (!alive) return
          setSessions(rows)
          setError(null)
        })
        .catch((e) => {
          if (!alive) return
          setError(e instanceof Error ? e.message : 'Не удалось загрузить сессии')
        })
        .finally(() => {
          if (alive) setLoading(false)
        })

    load()
    const timer = window.setInterval(load, 20_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [botId, refreshKey])

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted">
        <Loader2 size={18} className="animate-spin" />
        Загрузка сессий…
      </div>
    )
  }

  return (
    <Card className="overflow-hidden p-0" data-testid="bot-sessions-tab">
      {error && (
        <div className="border-b border-border bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Начало</th>
              <th className="px-4 py-3 font-medium">Конец</th>
              <th className="px-4 py-3 font-medium">Длительность</th>
              <th className="px-4 py-3 font-medium">Режим</th>
              <th className="px-4 py-3 font-medium text-right">Сделок</th>
              <th className="px-4 py-3 font-medium text-right">Неудачных</th>
              <th className="px-4 py-3 font-medium text-right">Результат</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => {
              const durationMs = (session.active ? Date.now() : session.endedAt) - session.startedAt
              const pnlColor = session.pnl >= 0 ? 'text-success' : 'text-error'
              return (
                <tr
                  key={session.id}
                  className="cursor-pointer border-b border-border transition-colors hover:bg-card-hover"
                  onClick={() => navigate(`/bots/${botId}/sessions/${session.id}`)}
                  data-testid={`session-row-${session.id}`}
                >
                  <td className="px-4 py-3 font-mono text-foreground">{fmtSessionTime(session.startedAt)}</td>
                  <td className="px-4 py-3">
                    {session.active ? (
                      <Badge variant="success">идёт</Badge>
                    ) : (
                      <span className="font-mono text-foreground">{fmtSessionTime(session.endedAt)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">{fmtDurationMs(durationMs)}</td>
                  <td className="px-4 py-3 text-foreground">{sessionModeLabel(session.mode)}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{session.tradesCount}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {session.failedCount > 0 ? (
                      <span className="text-error">{session.failedCount}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${pnlColor}`}>
                    {fmtSigned(session.pnl)}
                    <span className="ml-1 text-xs opacity-80">
                      ({session.pnlPct >= 0 ? '+' : ''}{session.pnlPct.toFixed(2)}%)
                    </span>
                  </td>
                </tr>
              )
            })}
            {sessions.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  Сессий ещё нет — запустите бота, сессия появится автоматически.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
