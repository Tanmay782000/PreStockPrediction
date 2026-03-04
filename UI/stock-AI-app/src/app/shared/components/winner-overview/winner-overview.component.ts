import { Input, isStandalone } from '@angular/core';
import { Component } from '@angular/core';

@Component({
  selector: 'app-winner-overview',
  imports: [],
  templateUrl: './winner-overview.component.html',
  styleUrl: './winner-overview.component.css',
  standalone:true
})
export class WinnerOverviewComponent {
  @Input() finalArr: any =   [{ "Name": "India", "Value": "India" },
  { "Name": "Term", "Value": "Mid Term[60%]" },
  { "Name": "Category", "Value": "Nifty 50[30%]" },
  { "Name": "Sectors", "Value": "Information Technology[15%], Utilities[13%], Consumer Discretionary[12%]" },
  { "Name": "Stocks", "Value": "Infosys[32%], Reliance[25%], HDFC Bank[21%], TCS[22%]" }]

  constructor(){}
  ngOnInit(){
  }
}
