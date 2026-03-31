import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LiveChartGateway } from './live-chart.gateway';
import { Subscription } from '../subscriptions/entities/subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: cfg.getOrThrow<string>('jwt.accessExpiresIn') as any,
        },
      }),
    }),
  ],
  providers: [LiveChartGateway],
})
export class LiveChartModule {}
