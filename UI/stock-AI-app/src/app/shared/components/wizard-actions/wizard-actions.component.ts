import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { WizardService } from '../../../services/stepper.service';
import { CountryService } from '../../../services/country.service';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-wizard-actions',
  imports: [CommonModule],
  templateUrl: './wizard-actions.component.html',
  styleUrl: './wizard-actions.component.css',
  standalone:true
})
export class WizardActionsComponent {
constructor(private wizardService: WizardService,private AuthService:AuthService, private countryService:CountryService, private router:Router){}

@Input() public isPrevious:boolean = true;
@Input() public isNext:boolean = true;

nextStep() {
  debugger
  this.wizardService.next();
  
  console.log(this.wizardService.stepper.selectedIndex)
  if(this.wizardService.stepper.selectedIndex == 0)
    this.router.navigate(['']);
  else if(this.wizardService.stepper.selectedIndex == 1)
    this.router.navigate(['/term-analysis']);
  else if(this.wizardService.stepper.selectedIndex == 2)
    this.router.navigate(['/category-analysis']);
  else if(this.wizardService.stepper.selectedIndex == 3)
    this.router.navigate(['/sector-analysis']);
  else if(this.wizardService.stepper.selectedIndex == 4)
    this.router.navigate(['/stock-analysis']);
}

previousStep()
{
  debugger
  this.wizardService.previous();
    console.log(this.wizardService.stepper.selectedIndex)
  if(this.wizardService.stepper.selectedIndex == 0)
    this.router.navigate(['']);
  else if(this.wizardService.stepper.selectedIndex == 1)
    this.router.navigate(['/term-analysis']);
  else if(this.wizardService.stepper.selectedIndex == 2)
    this.router.navigate(['/category-analysis']);
  else if(this.wizardService.stepper.selectedIndex == 3)
    this.router.navigate(['/sector-analysis']);
  else if(this.wizardService.stepper.selectedIndex == 4)
    this.router.navigate(['/stock-analysis']);
}
}
