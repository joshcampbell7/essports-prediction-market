export interface MarketInfo {
  id: number,
  question: string
  marketType: string
  oracleUrl: string
  closeTime: number
  resolved: boolean
  winningOutcome: number
  totalPool: number
}
