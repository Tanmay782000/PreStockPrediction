import { Component,OnInit } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';

@Component({
  selector: 'app-category-analysis',
  imports: [AnalysisOverviewComponent, WinnerOverviewComponent,WizardActionsComponent],
  templateUrl: './category-analysis.component.html',
  styleUrl: './category-analysis.component.css',
  standalone:true
})
export class CategoryAnalysisComponent implements OnInit {
public title: any = "Category Analysis";
constructor(){}
ngOnInit(): void { 
  // this.wizardStepper.stepper.selectedIndex = 2
}
}
