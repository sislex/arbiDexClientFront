export type SourceType = 'dex' | 'cex';

export interface Source {
  id: string;
  name: string;
  displayName: string;
  type: SourceType;
  icon?: string;
  isActive: boolean;
}

