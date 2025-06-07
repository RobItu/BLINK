export type CurrencyType = 'USDC' | 'USD';

export interface TransactionData {
  for: string;
  amount: string;
  currency: CurrencyType;
  timestamp: number;
  id: string;
}

export type RootStackParamList = {
  TransactionDetails: { transactionData: TransactionData };
};