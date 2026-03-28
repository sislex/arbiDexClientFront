import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Source } from './entities/source.entity';
import { TradingPair } from './entities/trading-pair.entity';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Source)
    private readonly sourcesRepo: Repository<Source>,
    @InjectRepository(TradingPair)
    private readonly pairsRepo: Repository<TradingPair>,
  ) {}

  getSources(): Promise<Source[]> {
    return this.sourcesRepo.find({ where: { isActive: true } });
  }

  getPairs(): Promise<TradingPair[]> {
    return this.pairsRepo.find();
  }
}

