import {
  buildTxUrl,
  computeAmountOutMin,
  getRouterValidationError,
} from './swap-execution.service';

describe('SwapExecutionService helpers', () => {
  const routers = {
    uniswapV2: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    sushiV2: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    camelotV2: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
  };

  describe('computeAmountOutMin', () => {
    it('должен считать минимум по preview и slippage', () => {
      const result = computeAmountOutMin(1_000_000n, 50);
      expect(result).toBe(995_000n);
    });

    it('должен возвращать 0 для нулевого preview', () => {
      const result = computeAmountOutMin(0n, 50);
      expect(result).toBe(0n);
    });
  });

  describe('buildTxUrl', () => {
    it('должен подставить hash в шаблон с {hash}', () => {
      const hash = '0xabc';
      const url = buildTxUrl('https://arbiscan.io/tx/{hash}', hash);
      expect(url).toBe('https://arbiscan.io/tx/0xabc');
    });

    it('должен добавить hash через слеш если шаблона нет', () => {
      const hash = '0xabc';
      const url = buildTxUrl('https://arbiscan.io/tx', hash);
      expect(url).toBe('https://arbiscan.io/tx/0xabc');
    });
  });

  describe('getRouterValidationError', () => {
    it('должен требовать ZeroAddress для pool/algebra/v4 kind', () => {
      const err = getRouterValidationError(1, routers.uniswapV2, routers);
      expect(err).toContain('router должен быть');
    });

    it('должен разрешать только V2 роутеры для kind=0', () => {
      const ok = getRouterValidationError(0, routers.sushiV2, routers);
      const bad = getRouterValidationError(0, routers.camelotV2, routers);

      expect(ok).toBeNull();
      expect(bad).toContain('не разрешён для kind=0');
    });

    it('должен требовать совпадение с CAMELOT роутером для kind=2', () => {
      const ok = getRouterValidationError(2, routers.camelotV2, routers);
      const bad = getRouterValidationError(2, routers.uniswapV2, routers);

      expect(ok).toBeNull();
      expect(bad).toContain('не совпадает');
    });
  });
});

