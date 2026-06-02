# SwapExecution API

Публичный endpoint: `POST /api/swap-execution/execute`.

## Что делает

- Выбирает сеть по `networkPrefix` (`ARBITRUM | OPTIMISM | BASE`)
- Читает конфиг из `.env`: `<PREFIX>_RPC`, `<PREFIX>_EXECUTOR_ADDRESS`, `<PREFIX>_TX_URL`
- Делает `preview` через `executeSwaps.staticCall`
- Применяет `amountOutMin`:
  - если клиент передал `amountOutMin > 0` — использует значение клиента
  - если `amountOutMin = 0` или поле отсутствует — считает из preview и `slippageBps`
- (Опционально) отправляет on-chain транзакцию
- Возвращает агрегированные метрики, `stepLogs` (raw) и `stepLogsNormalized` (decimal)

## Минимальный пример запроса

```json
{
  "networkPrefix": "ARBITRUM",
  "profitToken": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  "slippageBps": 50,
  "execute": true,
  "steps": [
    {
      "kind": 1,
      "router": "0x0000000000000000000000000000000000000000",
      "path": [],
      "pool": "0xbE3aD6a5669Dc0B8b12FeBC03608860C31E2eef6",
      "tokenIn": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
      "tokenOut": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      "amountIn": "1000000",
      "amountOutMin": "0",
      "sqrtPriceLimitX96": "0",
      "deadline": "0"
    }
  ]
}
```

