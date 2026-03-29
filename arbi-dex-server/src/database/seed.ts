import { DataSource } from 'typeorm';
import { Source } from '../catalog/entities/source.entity';
import { TradingPair } from '../catalog/entities/trading-pair.entity';

const SOURCES: Partial<Source>[] = [
  { id: 'dex_arbitrum', name: 'dex_arbitrum', displayName: 'Arbitrum DEX', type: 'dex', isActive: true },
  { id: 'cex_binance',  name: 'cex_binance',  displayName: 'Binance',      type: 'cex', isActive: true },
  { id: 'cex_mex',      name: 'cex_mex',      displayName: 'MEXC',         type: 'cex', isActive: true },
  { id: 'cex_bybit',    name: 'cex_bybit',    displayName: 'Bybit',        type: 'cex', isActive: true },
  { id: 'cex_okx',      name: 'cex_okx',      displayName: 'OKX',          type: 'cex', isActive: true },
  { id: 'cex_kucoin',   name: 'cex_kucoin',   displayName: 'KuCoin',       type: 'cex', isActive: true },
  { id: 'cex_gateio',   name: 'cex_gateio',   displayName: 'Gate.io',      type: 'cex', isActive: true },
];

const PAIRS: Partial<TradingPair>[] = [
  { id: 'USDC_WETH', base: 'USDC', quote: 'WETH', displayName: 'USDC/WETH' },
  { id: 'ARB_WBTC',  base: 'ARB',  quote: 'WBTC', displayName: 'ARB/WBTC'  },
  { id: 'ETH_USDT',  base: 'ETH',  quote: 'USDT', displayName: 'ETH/USDT'  },
  { id: 'WBTC_USDC', base: 'WBTC', quote: 'USDC', displayName: 'WBTC/USDC' },
];

export async function seedCatalog(dataSource: DataSource): Promise<void> {
  const sourcesRepo = dataSource.getRepository(Source);
  const pairsRepo = dataSource.getRepository(TradingPair);

  for (const source of SOURCES) {
    const exists = await sourcesRepo.findOne({ where: { id: source.id } });
    if (!exists) await sourcesRepo.save(source);
  }

  for (const pair of PAIRS) {
    const exists = await pairsRepo.findOne({ where: { id: pair.id } });
    if (!exists) await pairsRepo.save(pair);
  }

  console.log('✅ Catalog seed completed');
}


