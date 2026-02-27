import { Component, OnInit } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';

@Component({
  selector: 'app-term-analysis',
  imports: [AnalysisOverviewComponent,WinnerOverviewComponent,WizardActionsComponent],
  templateUrl: './term-analysis.component.html',
  styleUrl: './term-analysis.component.css',
  standalone: true
})
export class TermAnalysisComponent implements OnInit {
public title: any = "Term Analysis";

constructor(){}
ngOnInit(): void { 
  
}
}
