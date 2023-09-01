import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'minsec'
})
export class MinsecPipe implements PipeTransform {

  transform(value: number): string {
    const minutes: number = Math.floor(value / 60);
    const secs: number = Math.floor(value - minutes * 60);
    return minutes.toString().padStart(2, '0') + ':' + 
        secs.toString().padStart(2, '0');
  }
}
