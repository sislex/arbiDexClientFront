export enum WalletProvider {
  MetaMask = 'MetaMask',
  WalletConnect = 'WalletConnect',
  CoinbaseWallet = 'CoinbaseWallet',
}

export interface WalletInfo {
  address: string;
  provider: WalletProvider;
}

