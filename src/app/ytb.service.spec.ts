import { TestBed } from '@angular/core/testing';

import { YtbService } from './ytb.service';

describe('YtbService', () => {
  let service: YtbService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(YtbService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
