export interface StepCondition {
  id: string
  ruleNumber: number
  label: string
  detail?: string
  passed: boolean
}

export interface BotEvent {
  id: string
  time: string
  type: 'BUY' | 'SELL' | 'INFO' | 'ERROR'
  message: string
}

export const DEMO_BUY_CONDITIONS: StepCondition[] = [
  { id: 'b1', ruleNumber: 1, label: 'Condition enabled', detail: 'req: steps=5 percent >= 1%', passed: false },
  { id: 'b2', ruleNumber: 2, label: 'No active transaction', passed: true },
  { id: 'b3', ruleNumber: 3, label: 'Average price above buy for last N steps', detail: 'req: steps=5 percent >= 1%', passed: false },
  { id: 'b4', ruleNumber: 4, label: 'Buy price does not exceed sell price by more than limit', detail: 'req: percent <= 50%', passed: true },
  { id: 'b5', ruleNumber: 5, label: 'Time since last transaction', detail: 'req: ms >= 60000', passed: true },
  { id: 'b6', ruleNumber: 6, label: 'Minimum USDT balance for buy', detail: 'req: percent >= 1000%', passed: false },
]

export const DEMO_SELL_CONDITIONS: StepCondition[] = [
  { id: 's1', ruleNumber: 3, label: 'Condition enabled', detail: 'req: steps=5 percent >= 1%', passed: false },
  { id: 's2', ruleNumber: 4, label: 'No active transaction', passed: false },
  { id: 's3', ruleNumber: 7, label: 'Average price above sell for last N steps', detail: 'req: steps=5 percent >= 1%', passed: false },
  { id: 's4', ruleNumber: 9, label: 'Time since last transaction', detail: 'req: ms >= 60000', passed: true },
  { id: 's5', ruleNumber: 11, label: 'Minimum USDT balance for sell', detail: 'req: percent >= 1000%', passed: false },
]

export const DEMO_EVENTS: BotEvent[] = [
  { id: '1', time: '05:43:11', type: 'BUY', message: 'BUY FILLED' },
  { id: '2', time: '05:43:11', type: 'BUY', message: 'BUY REQUEST' },
  { id: '3', time: '05:43:37', type: 'SELL', message: 'SELL FILLED' },
  { id: '4', time: '05:43:37', type: 'SELL', message: 'SELL REQUEST' },
  { id: '5', time: '05:44:02', type: 'BUY', message: 'BUY FILLED' },
  { id: '6', time: '05:44:02', type: 'BUY', message: 'BUY REQUEST' },
  { id: '7', time: '05:44:28', type: 'SELL', message: 'SELL FILLED' },
  { id: '8', time: '05:45:01', type: 'INFO', message: 'Average crossed trading price' },
  { id: '9', time: '05:45:15', type: 'BUY', message: 'BUY REQUEST' },
  { id: '10', time: '05:45:16', type: 'BUY', message: 'BUY FILLED' },
  { id: '11', time: '05:46:02', type: 'SELL', message: 'SELL REQUEST' },
  { id: '12', time: '05:46:03', type: 'SELL', message: 'SELL FILLED' },
]

export const DEMO_TOTAL_POINTS = 1000
