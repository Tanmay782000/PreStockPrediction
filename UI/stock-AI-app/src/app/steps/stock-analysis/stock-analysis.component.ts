import { Component } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';

@Component({
  selector: 'app-stock-analysis',
  imports: [AnalysisOverviewComponent,WinnerOverviewComponent,WizardActionsComponent],
  templateUrl: 'stock-analysis.component.html',
  styleUrl: 'stock-analysis.component.css',
  standalone:true
})
export class StockAnalysisComponent {
public title: any = "Stock Analysis";
}
