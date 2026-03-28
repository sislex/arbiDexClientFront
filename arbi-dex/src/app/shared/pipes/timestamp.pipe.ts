import { Pipe, PipeTransform } from '@angular/core';
import { formatTimestamp } from '../utils/format.utils';

@Pipe({ name: 'tsTime', standalone: true })
export class TimestampPipe implements PipeTransform {
  transform(value: number): string {
    return formatTimestamp(value);
  }
}

