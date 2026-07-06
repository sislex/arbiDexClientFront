import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { Socket } from 'socket.io';
import { LiveChartGateway } from './live-chart.gateway';
import { Subscription } from '../subscriptions/entities/subscription.entity';

/**
 * Locks the Phase 1 WebSocket auth fixes: a live-chart client must present a
 * valid JWT and own the requested subscription, otherwise it is disconnected
 * (no unauthenticated stream, no IDOR).
 */
describe('LiveChartGateway.handleConnection', () => {
  let gateway: LiveChartGateway;
  let jwt: { verify: jest.Mock };
  let subsRepo: { findOne: jest.Mock };

  const makeClient = (auth: Record<string, unknown>, query: Record<string, unknown> = {}): Socket =>
    ({ id: 'sock-1', handshake: { auth, query }, disconnect: jest.fn() } as unknown as Socket);

  beforeEach(() => {
    jwt = { verify: jest.fn() };
    subsRepo = { findOne: jest.fn() };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://market-data'),
      get: jest.fn().mockReturnValue('access-secret'),
    } as unknown as ConfigService;
    gateway = new LiveChartGateway(
      jwt as unknown as JwtService,
      config,
      subsRepo as unknown as Repository<Subscription>,
    );
  });

  it('disconnects when no token is provided', async () => {
    const client = makeClient({});
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalled();
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('disconnects when the token is invalid', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('bad token');
    });
    const client = makeClient({ token: 'garbage' }, { subscriptionId: 's1' });
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalled();
    expect(subsRepo.findOne).not.toHaveBeenCalled();
  });

  it('disconnects when subscriptionId is missing', async () => {
    jwt.verify.mockReturnValue({ sub: 'u1' });
    const client = makeClient({ token: 'ok' }, {});
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalled();
    expect(subsRepo.findOne).not.toHaveBeenCalled();
  });

  it('disconnects when the subscription is not owned by the token user (anti-IDOR)', async () => {
    jwt.verify.mockReturnValue({ sub: 'u1' });
    subsRepo.findOne.mockResolvedValue(null);
    const client = makeClient({ token: 'ok' }, { subscriptionId: 's1' });
    await gateway.handleConnection(client);
    expect(subsRepo.findOne).toHaveBeenCalledWith({ where: { id: 's1', userId: 'u1' } });
    expect(client.disconnect).toHaveBeenCalled();
  });
});
