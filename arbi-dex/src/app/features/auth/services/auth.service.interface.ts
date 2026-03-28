import { WalletInfo, WalletProvider } from '../../../shared/models';
import { Observable } from 'rxjs';

export abstract class IAuthService {
  abstract connectWallet(provider: WalletProvider): Observable<WalletInfo>;
}

