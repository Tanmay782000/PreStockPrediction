import { Component } from '@angular/core';
import { WizardStepperComponent } from '../../shared/components/wizard-stepper/wizard-stepper.component';

@Component({
  selector: 'app-country-selection',
  imports: [WizardStepperComponent],
  templateUrl: './country-selection.component.html',
  styleUrl: './country-selection.component.css',
  standalone: true
})
export class CountrySelectionComponent {

}
