import { Component,OnInit } from '@angular/core';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';

@Component({
  selector: 'app-country-selection',
  imports: [WizardActionsComponent],
  templateUrl: './country-selection.component.html',
  styleUrl: './country-selection.component.css',
  standalone: true
})
export class CountrySelectionComponent implements OnInit{
constructor(){}
selectedCountry: string = '1';
ngOnInit(): void { 
   
}

selectCountry(country: string) {
  this.selectedCountry = country;
}
}
