import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlaybackState, PLAYBACK_SPEEDS, PlaybackSpeed } from '../../models';

@Component({
  selector: 'app-playback-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatTooltipModule,
  ],
  template: `
    <div class="player" *ngIf="state">
      <!-- Controls row -->
      <div class="player__controls">
        <!-- Play / Pause -->
        <button mat-icon-button
                class="player__btn"
                (click)="state.isPlaying ? pause.emit() : play.emit()"
                [matTooltip]="state.isPlaying ? 'Pause' : 'Play'">
          <mat-icon>{{ state.isPlaying ? 'pause' : 'play_arrow' }}</mat-icon>
        </button>

        <!-- Stop / Reset -->
        <button mat-icon-button
                class="player__btn"
                (click)="stop.emit()"
                matTooltip="Stop & Reset">
          <mat-icon>stop</mat-icon>
        </button>

        <!-- Speed -->
        <button mat-stroked-button
                class="player__speed-btn"
                (click)="cycleSpeed()"
                matTooltip="Change playback speed">
          {{ state.speed }}×
        </button>

        <!-- Current time -->
        <span class="player__time">
          {{ state.currentTime | date:'dd MMM HH:mm:ss' }}
        </span>

        <!-- Progress text -->
        <span class="player__progress-text">
          {{ state.currentIndex + 1 }} / {{ state.totalPoints }}
        </span>

        <!-- Playback badge -->
        <span class="player__badge" [class.player__badge--playing]="state.isPlaying">
          <span class="player__badge-dot"></span>
          {{ state.isPlaying ? 'PLAYING' : 'PAUSED' }}
        </span>
      </div>

      <!-- Timeline slider -->
      <div class="player__timeline">
        <span class="player__timeline-label">{{ state.startTime | date:'dd MMM HH:mm' }}</span>
        <mat-slider class="player__slider"
                    [min]="0"
                    [max]="1000"
                    [step]="1"
                    discrete>
          <input matSliderThumb
                 [value]="state.progress * 1000"
                 (valueChange)="onSliderChange($event)" />
        </mat-slider>
        <span class="player__timeline-label">{{ state.endTime | date:'dd MMM HH:mm' }}</span>
      </div>

      <!-- Speed presets row -->
      <div class="player__speed-row">
        <span class="player__speed-label">Speed:</span>
        <button *ngFor="let s of speeds"
                mat-stroked-button
                class="player__speed-preset"
                [class.player__speed-preset--active]="state.speed === s"
                (click)="speedChange.emit(s)">
          {{ s }}×
        </button>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;

    .player {
      background: var(--color-surface, #1e222d);
      border: 1px solid var(--color-border, #2b3139);
      border-radius: t.$radius-md;
      padding: t.$spacing-md;
      display: flex;
      flex-direction: column;
      gap: t.$spacing-sm;
    }

    .player__controls {
      display: flex;
      align-items: center;
      gap: t.$spacing-sm;
      flex-wrap: wrap;
    }

    .player__btn {
      color: var(--color-text-primary, #eaecef);
    }

    .player__speed-btn {
      min-width: 56px;
      font-weight: 700;
      font-size: 14px;
      color: var(--color-text-primary, #eaecef);
      border-color: var(--color-border, #2b3139);
    }

    .player__time {
      font-family: monospace;
      font-size: t.$font-size-sm;
      color: var(--color-text-secondary, #848e9c);
      margin-left: auto;
    }

    .player__progress-text {
      font-size: t.$font-size-xs;
      color: var(--color-text-muted, #5e6673);
      font-family: monospace;
    }

    .player__badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: rgba(132, 142, 156, 0.15);
      border: 1px solid #848e9c;
      border-radius: 4px;
      color: #848e9c;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;

      &--playing {
        background: rgba(33, 150, 243, 0.15);
        border-color: #2196f3;
        color: #2196f3;
      }
    }

    .player__badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .player__badge--playing .player__badge-dot {
      animation: blink 1s ease-in-out infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .player__timeline {
      display: flex;
      align-items: center;
      gap: t.$spacing-sm;
    }

    .player__slider {
      flex: 1;
    }

    .player__timeline-label {
      font-size: t.$font-size-xs;
      color: var(--color-text-muted, #5e6673);
      white-space: nowrap;
      font-family: monospace;
    }

    .player__speed-row {
      display: flex;
      align-items: center;
      gap: t.$spacing-xs;
      flex-wrap: wrap;
    }

    .player__speed-label {
      font-size: t.$font-size-xs;
      color: var(--color-text-muted, #5e6673);
      margin-right: 4px;
    }

    .player__speed-preset {
      min-width: 44px;
      height: 28px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-secondary, #848e9c);
      border-color: var(--color-border, #2b3139);

      &--active {
        color: #2196f3;
        border-color: #2196f3;
        background: rgba(33, 150, 243, 0.1);
      }
    }
  `],
})
export class PlaybackPlayerComponent {
  @Input() state!: PlaybackState;

  @Output() play = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() stop = new EventEmitter<void>();
  @Output() speedChange = new EventEmitter<PlaybackSpeed>();
  @Output() seek = new EventEmitter<number>();

  readonly speeds = PLAYBACK_SPEEDS;

  cycleSpeed(): void {
    const idx = PLAYBACK_SPEEDS.indexOf(this.state.speed);
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    this.speedChange.emit(next);
  }

  onSliderChange(value: number): void {
    this.seek.emit(value / 1000);
  }
}

