import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/SearchInput'

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Настройки платформы и аккаунта" />
      <PageContent className="max-w-3xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center text-2xl font-bold text-white">
                A
              </div>
              <div>
                <p className="text-lg font-semibold text-white">Alex Trader</p>
                <p className="text-sm text-muted">alex@example.com · Pro Plan</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted block mb-1.5">Display Name</label>
                <input className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm" defaultValue="Alex Trader" />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1.5">Timezone</label>
                <Select value="utc3" onChange={() => {}} options={[
                  { value: 'utc3', label: 'UTC+3 Moscow' },
                  { value: 'utc0', label: 'UTC+0 London' },
                  { value: 'utc-5', label: 'UTC-5 New York' },
                ]} className="w-full" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>API Connections</CardTitle></CardHeader>
          <div className="space-y-3">
            {['Binance', 'Bybit', 'OKX'].map((ex) => (
              <div key={ex} className="flex items-center justify-between p-4 rounded-xl bg-surface">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center text-sm font-bold text-white">{ex[0]}</div>
                  <div>
                    <p className="font-medium text-white">{ex}</p>
                    <p className="text-xs text-success">Connected</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Manage</Button>
              </div>
            ))}
            <Button variant="secondary" className="w-full">+ Add Exchange</Button>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <div className="space-y-4">
            {[
              { label: 'Trade Executed', desc: 'Уведомление при исполнении сделки' },
              { label: 'Bot Error', desc: 'Уведомление при ошибке бота' },
              { label: 'Daily Summary', desc: 'Ежедневный отчёт о прибыли' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
                <div className="w-10 h-6 rounded-full bg-accent-purple relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Danger Zone</CardTitle></CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Emergency Stop All Bots</p>
              <p className="text-xs text-muted">Остановить все активные боты немедленно</p>
            </div>
            <Button variant="danger" size="sm">Stop All</Button>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button>Save Changes</Button>
        </div>
      </PageContent>
    </>
  )
}
