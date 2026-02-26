import { Component, OnInit } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';

@Component({
  selector: 'app-term-analysis',
  imports: [AnalysisOverviewComponent,WinnerOverviewComponent],
  templateUrl: './term-analysis.component.html',
  styleUrl: './term-analysis.component.css',
  standalone: true
})
export class TermAnalysisComponent implements OnInit {
constructor(){}
ngOnInit(): void { 
  // this.wizardStepper.stepper.selectedIndex = 1
}
}
