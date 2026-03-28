import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { SubscriptionDraft } from '../../../shared/models';
import {
  addSubscription,
  removeSubscription,
  toggleSubscription,
  setDraft,
  clearDraft,
  loadSubscriptions,
} from '../store/subscriptions.actions';
import {
  selectSavedSubscriptions,
  selectActiveSubscriptions,
  selectSubscriptionsCount,
  selectDraft,
  selectDraftIsComplete,
  selectSubscriptionsLoading,
} from '../store/subscriptions.selectors';

@Injectable({ providedIn: 'root' })
export class SubscriptionsFacade {
  private readonly store = inject(Store);

  readonly saved$ = this.store.select(selectSavedSubscriptions);
  readonly active$ = this.store.select(selectActiveSubscriptions);
  readonly count$ = this.store.select(selectSubscriptionsCount);
  readonly draft$ = this.store.select(selectDraft);
  readonly draftIsComplete$ = this.store.select(selectDraftIsComplete);
  readonly loading$ = this.store.select(selectSubscriptionsLoading);

  load(): void {
    this.store.dispatch(loadSubscriptions());
  }

  add(sourceId: string, pairId: string): void {
    this.store.dispatch(addSubscription({ sourceId, pairId }));
  }

  remove(id: string): void {
    this.store.dispatch(removeSubscription({ id }));
  }

  toggle(id: string): void {
    this.store.dispatch(toggleSubscription({ id }));
  }

  setDraft(draft: SubscriptionDraft): void {
    this.store.dispatch(setDraft({ draft }));
  }

  clearDraft(): void {
    this.store.dispatch(clearDraft());
  }
}

