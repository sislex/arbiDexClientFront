import { WalletInfo, WalletProvider, AuthResult } from '../../../shared/models';
import { Observable } from 'rxjs';

/** Ответ от POST /api/auth/verify */
export interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; walletAddress: string; walletProvider: string };
}

/** Ответ от POST /api/auth/refresh */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export abstract class IAuthService {
  /** Подключиться к кошельку и получить адрес */
  abstract connectWallet(provider: WalletProvider): Observable<WalletInfo>;

  /** Получить одноразовый nonce для подписи (POST /api/auth/nonce) */
  abstract getNonce(walletAddress: string): Observable<{ nonce: string }>;

  /** Подписать сообщение кошельком */
  abstract signMessage(message: string, walletAddress: string): Observable<string>;

  /** Верифицировать подпись и получить JWT-токены (POST /api/auth/verify) */
  abstract verifySignature(
    walletAddress: string,
    signature: string,
    walletProvider?: string,
  ): Observable<VerifyResponse>;

  /** Обновить access-токен по refresh-токену (POST /api/auth/refresh) */
  abstract refresh(refreshToken: string): Observable<RefreshResponse>;
}

