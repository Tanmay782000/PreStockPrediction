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
  { "Name": "Mid Term", "Value": "60%" },
  { "Name": "Midcap 50", "Value": "30%" },
  { "Name": "Category", "Value": "Information Technology[50%], Financial[34%], Healthcare[60%]" },
  { "Name": "Stocks", "Value": "Dr.Reddy[40%], TCS[33%], HDFC[55%]" }]

  constructor(){}
  ngOnInit(){
  }
}
