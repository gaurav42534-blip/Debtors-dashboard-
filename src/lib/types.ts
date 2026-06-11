export interface Debtor {
  id: string
  user_id: string
  name: string
  phone: string
  default_terms: number
  limit_amount: number
  created_at: string
}

export interface Transaction {
  id: string
  debtor_id: string
  type: 'sale' | 'payment'
  amount: number
  ref_note: string
  transaction_date: string
  created_at: string
}

export interface DebtorWithTransactions extends Debtor {
  transactions: Transaction[]
}

export interface OverdueDebtor extends DebtorWithTransactions {
  overdueAmount: number
}
