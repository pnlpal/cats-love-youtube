import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CaptionManComponent } from './caption-man.component';

describe('CaptionManComponent', () => {
  let component: CaptionManComponent;
  let fixture: ComponentFixture<CaptionManComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CaptionManComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CaptionManComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
