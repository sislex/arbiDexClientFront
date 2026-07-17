import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Worker } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';
import { AutotuneCombo, AutotuneResult, StrategyConfigData } from '../demo/engine/types';
import type { MarketStep } from '@sislex/arbi-conditions-libs';

/** Таблица live-результатов держит не больше 500 лучших прогонов. */
const TOP_LIMIT = 500;
/** Завершённые задачи живут ещё 60 минут (меню расчётов их показывает). */
const RETENTION_MS = 60 * 60 * 1000;
/** Порция комбо на один воркер-заход: маленькая, чтобы пауза/перераспределение
 * потоков срабатывали быстро, а прогресс шёл не реже раза в несколько секунд. */
const CHUNK_SIZE = 20;

export type ComputeJobStatus = 'queued' | 'running' | 'paused' | 'done' | 'error';

export interface AutotuneJobSnapshot {
  jobId: string;
  botId: string;
  /** Человекочитаемая подпись задачи (бот + параметры). */
  label: string;
  status: ComputeJobStatus;
  total: number;
  done: number;
  gridTotal: number;
  /** Сколько потоков запрошено задачей и сколько занято прямо сейчас. */
  threadsRequested: number;
  threadsActive: number;
  /** Позиция в очереди (для queued/paused); null когда не в очереди. */
  queuePosition: number | null;
  startedAt: number;
  elapsedMs: number;
  topCombos: AutotuneCombo[];
  best: AutotuneCombo | null;
  error: string | null;
  result: (AutotuneResult & { tookMs: number }) | null;
}

interface ComputeJob {
  jobId: string;
  userId: string;
  botId: string;
  label: string;
  status: ComputeJobStatus;
  /** Порядок в очереди — пауза перекидывает в конец (больший order). */
  order: number;
  threadsRequested: number;
  inFlight: number;
  pending: { index: number; params: Record<string, number> }[];
  done: number;
  total: number;
  gridTotal: number;
  topCombos: AutotuneCombo[];
  steps: MarketStep[];
  strategy: StrategyConfigData;
  initialBalance?: number;
  startedAt: number;
  /** Чистое время выполнения (паузы не считаем): аккумулятор + метка запуска. */
  runMsAccum: number;
  runSince: number | null;
  error: string | null;
  result: (AutotuneResult & { tookMs: number }) | null;
}

/**
 * Планировщик фоновых расчётов (автоподборов) с общим пулом потоков сервера:
 *
 * - задача занимает до `threadsRequested` потоков; свободные потоки пула
 *   раздаются задачам порциями по CHUNK_SIZE комбо (один воркер на порцию);
 * - нет свободных потоков → задача стоит в очереди (FIFO по `order`);
 * - освободился поток → его немедленно получает следующая задача очереди;
 * - пауза: задача перестаёт получать потоки (начатые порции доработают) и
 *   уходит в конец очереди; снятие с паузы возвращает её в очередь;
 * - на одном боте может идти несколько расчётов одновременно.
 */
@Injectable()
export class AutotuneJobsService {
  private readonly jobs = new Map<string, ComputeJob>();
  private orderSeq = 0;
  private activeThreads = 0;
  private totalThreads = Math.max(1, Math.min(6, (os.availableParallelism?.() ?? os.cpus().length) - 1));
  private threadsSeeded = false;

  // ── Пул потоков ────────────────────────────────────────────────────────────

  getConfig(): { totalThreads: number; activeThreads: number; queuedJobs: number } {
    const queuedJobs = [...this.jobs.values()].filter((j) => j.status === 'queued').length;
    return { totalThreads: this.totalThreads, activeThreads: this.activeThreads, queuedJobs };
  }

  setTotalThreads(n: number): void {
    if (!Number.isFinite(n) || n < 1 || n > 64) {
      throw new BadRequestException('Число потоков должно быть от 1 до 64');
    }
    this.totalThreads = Math.round(n);
    this.threadsSeeded = true;
    this.tick();
  }

  /** Первичная инициализация пула из сохранённых настроек (после рестарта). */
  seedTotalThreads(n: number): void {
    if (this.threadsSeeded || !Number.isFinite(n) || n < 1 || n > 64) return;
    this.totalThreads = Math.round(n);
    this.threadsSeeded = true;
  }

  // ── Задачи ─────────────────────────────────────────────────────────────────

  submit(input: {
    userId: string;
    botId: string;
    label: string;
    comboParams: Record<string, number>[];
    gridTotal: number;
    steps: MarketStep[];
    strategy: StrategyConfigData;
    initialBalance?: number;
    threads?: number;
  }): AutotuneJobSnapshot {
    const job: ComputeJob = {
      jobId: randomUUID(),
      userId: input.userId,
      botId: input.botId,
      label: input.label,
      status: 'queued',
      order: ++this.orderSeq,
      threadsRequested: Math.max(1, Math.min(input.threads ?? this.totalThreads, 64)),
      inFlight: 0,
      pending: input.comboParams.map((params, index) => ({ index, params })),
      done: 0,
      total: input.comboParams.length,
      gridTotal: input.gridTotal,
      topCombos: [],
      steps: input.steps,
      strategy: input.strategy,
      initialBalance: input.initialBalance,
      startedAt: Date.now(),
      runMsAccum: 0,
      runSince: null,
      error: null,
      result: null,
    };
    this.jobs.set(job.jobId, job);
    this.tick();
    return this.snapshot(job);
  }

  pause(userId: string, jobId: string): AutotuneJobSnapshot {
    const job = this.find(userId, jobId);
    if (job.status !== 'running' && job.status !== 'queued') {
      throw new BadRequestException('Пауза доступна только для идущих или ожидающих расчётов');
    }
    if (job.runSince != null) {
      job.runMsAccum += Date.now() - job.runSince;
      job.runSince = null;
    }
    job.status = 'paused';
    // Пауза отправляет расчёт в конец списка.
    job.order = ++this.orderSeq;
    this.tick();
    return this.snapshot(job);
  }

  resume(userId: string, jobId: string): AutotuneJobSnapshot {
    const job = this.find(userId, jobId);
    if (job.status !== 'paused') {
      throw new BadRequestException('Снять с паузы можно только приостановленный расчёт');
    }
    job.status = 'queued';
    job.order = ++this.orderSeq;
    this.tick();
    return this.snapshot(job);
  }

  list(userId: string): AutotuneJobSnapshot[] {
    const rank: Record<ComputeJobStatus, number> = { running: 0, queued: 1, paused: 2, done: 3, error: 4 };
    return [...this.jobs.values()]
      .filter((j) => j.userId === userId)
      .sort((a, b) => rank[a.status] - rank[b.status] || a.order - b.order)
      .map((j) => this.snapshot(j));
  }

  get(userId: string, jobId: string): AutotuneJobSnapshot {
    return this.snapshot(this.find(userId, jobId));
  }

  // ── Планировщик ────────────────────────────────────────────────────────────

  /** Раздаёт свободные потоки пула задачам очереди (FIFO). */
  private tick(): void {
    while (this.activeThreads < this.totalThreads) {
      const job = [...this.jobs.values()]
        .filter(
          (j) =>
            (j.status === 'running' || j.status === 'queued') &&
            j.pending.length > 0 &&
            j.inFlight < j.threadsRequested,
        )
        .sort((a, b) => a.order - b.order)[0];
      if (!job) break;
      if (job.status === 'queued') {
        job.status = 'running';
        if (job.runSince == null) job.runSince = Date.now();
      }
      const chunk = job.pending.splice(0, CHUNK_SIZE);
      job.inFlight += 1;
      this.activeThreads += 1;
      this.runChunk(job, chunk);
    }
  }

  private runChunk(job: ComputeJob, chunk: { index: number; params: Record<string, number> }[]): void {
    const workerFile = path.join(__dirname, '../demo/engine/autotune.worker.js');
    const w = new Worker(workerFile, {
      workerData: {
        steps: job.steps,
        strategy: job.strategy,
        combos: chunk,
        initialBalance: job.initialBalance,
      },
    });
    let finished = false;
    const release = (err?: Error): void => {
      if (finished) return;
      finished = true;
      job.inFlight -= 1;
      this.activeThreads -= 1;
      if (err && job.status !== 'done') {
        job.status = 'error';
        job.error = err.message;
        this.scheduleCleanup(job.jobId);
      } else if (job.pending.length === 0 && job.inFlight === 0 && job.status === 'running') {
        this.finish(job);
      }
      this.tick();
    };
    w.on('message', (msg: { type: 'batch'; combos: AutotuneCombo[] } | { type: 'done' }) => {
      if (msg.type === 'batch') this.progress(job, msg.combos);
      else if (msg.type === 'done') release();
    });
    w.once('error', (e) => release(e));
    w.once('exit', (code) => {
      if (code !== 0) release(new Error(`Воркер расчёта завершился с кодом ${code}`));
    });
  }

  private progress(job: ComputeJob, batch: AutotuneCombo[]): void {
    if (job.status === 'done' || job.status === 'error') return;
    job.done += batch.length;
    job.topCombos = [...job.topCombos, ...batch]
      .sort((a, b) => b.stats.pnl - a.stats.pnl)
      .slice(0, TOP_LIMIT);
  }

  private finish(job: ComputeJob): void {
    if (job.runSince != null) {
      job.runMsAccum += Date.now() - job.runSince;
      job.runSince = null;
    }
    job.status = 'done';
    job.result = {
      id: `at_${job.botId}`,
      totalCombos: job.done,
      gridTotal: job.gridTotal,
      combos: job.topCombos,
      best: job.topCombos[0] ?? null,
      tookMs: job.runMsAccum,
    };
    this.scheduleCleanup(job.jobId);
  }

  private snapshot(job: ComputeJob): AutotuneJobSnapshot {
    const queue = [...this.jobs.values()]
      .filter((j) => j.userId === job.userId && (j.status === 'queued' || j.status === 'paused'))
      .sort((a, b) => a.order - b.order);
    const queuePosition =
      job.status === 'queued' || job.status === 'paused'
        ? queue.findIndex((j) => j.jobId === job.jobId) + 1
        : null;
    const elapsedMs = job.runMsAccum + (job.runSince != null ? Date.now() - job.runSince : 0);
    return {
      jobId: job.jobId,
      botId: job.botId,
      label: job.label,
      status: job.status,
      total: job.total,
      done: job.done,
      gridTotal: job.gridTotal,
      threadsRequested: job.threadsRequested,
      threadsActive: job.inFlight,
      queuePosition,
      startedAt: job.startedAt,
      elapsedMs,
      topCombos: job.topCombos,
      best: job.topCombos[0] ?? null,
      error: job.error,
      result: job.status === 'done' ? job.result : null,
    };
  }

  private find(userId: string, jobId: string): ComputeJob {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) throw new NotFoundException('Задача расчёта не найдена');
    return job;
  }

  private scheduleCleanup(jobId: string): void {
    const t = setTimeout(() => this.jobs.delete(jobId), RETENTION_MS);
    // Не держим процесс живым ради уборки кэша задач.
    t.unref?.();
  }
}
