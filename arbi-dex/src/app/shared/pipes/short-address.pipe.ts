import { Pipe, PipeTransform } from '@angular/core';
import { shortenAddress } from '../utils/format.utils';

@Pipe({ name: 'shortAddress', standalone: true })
export class ShortAddressPipe implements PipeTransform {
  transform(value: string, chars = 4): string {
    return shortenAddress(value, chars);
  }
}

