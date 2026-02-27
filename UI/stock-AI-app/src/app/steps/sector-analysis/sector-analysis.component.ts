import { Component } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';

@Component({
  selector: 'app-sector-analysis',
  imports: [AnalysisOverviewComponent,WinnerOverviewComponent,WizardActionsComponent],
  templateUrl: './sector-analysis.component.html',
  styleUrl: './sector-analysis.component.css',
  standalone:true
})
export class SectorAnalysisComponent {
public title: any = "Sector Analysis";
}
