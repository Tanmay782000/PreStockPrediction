import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { WizardStepperComponent } from './shared/components/wizard-stepper/wizard-stepper.component';
import { WizardActionsComponent } from './shared/components/wizard-actions/wizard-actions.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,HeaderComponent,WizardStepperComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  standalone: true
})
export class AppComponent {
  title = 'stock-AI-app';
}
