export interface Subscription {
  id: string;
  sourceId: string;
  pairId: string;
  enabled: boolean;
  createdAt: number;
}

export interface SubscriptionDraft {
  sourceId: string | null;
  pairId: string | null;
}

