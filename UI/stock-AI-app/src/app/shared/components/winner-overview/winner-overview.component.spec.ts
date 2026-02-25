import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WinnerOverviewComponent } from './winner-overview.component';

describe('WinnerOverviewComponent', () => {
  let component: WinnerOverviewComponent;
  let fixture: ComponentFixture<WinnerOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WinnerOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WinnerOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
