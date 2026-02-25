import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalysisOverviewComponent } from './analysis-overview.component';

describe('AnalysisOverviewComponent', () => {
  let component: AnalysisOverviewComponent;
  let fixture: ComponentFixture<AnalysisOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalysisOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
