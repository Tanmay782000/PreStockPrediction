import { Component,OnInit } from '@angular/core';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';
import { CountryService } from '../../services/country.service';

@Component({
  selector: 'app-country-selection',
  imports: [WizardActionsComponent],
  templateUrl: './country-selection.component.html',
  styleUrl: './country-selection.component.css',
  standalone: true
})
export class CountrySelectionComponent implements OnInit{
constructor(private countryService:CountryService){}
selectedCountry: string = '1';
ngOnInit(): void { 
  this.countryService.setSelectedCurrentCountry(this.selectedCountry);
}

selectCountry(country: string) {
  debugger;
  this.selectedCountry = country;
  this.countryService.setSelectedCurrentCountry(country);
}
}
