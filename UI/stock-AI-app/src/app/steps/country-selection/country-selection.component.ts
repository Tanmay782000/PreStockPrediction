import { Component,OnInit } from '@angular/core';

@Component({
  selector: 'app-country-selection',
  imports: [],
  templateUrl: './country-selection.component.html',
  styleUrl: './country-selection.component.css',
  standalone: true
})
export class CountrySelectionComponent implements OnInit{
constructor(){}
ngOnInit(): void { 
  // this.wizardStepper.stepper.selectedIndex = 0
}
}
