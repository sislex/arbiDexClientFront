export interface EngineConditionEvaluation {
  id: string
  group: 'toBuy' | 'toSell'
  passed: boolean
  current?: string
  required?: string
}
