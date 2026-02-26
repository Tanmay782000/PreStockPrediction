import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WizardActionsComponent } from './wizard-actions.component';

describe('WizardActionsComponent', () => {
  let component: WizardActionsComponent;
  let fixture: ComponentFixture<WizardActionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WizardActionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WizardActionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
