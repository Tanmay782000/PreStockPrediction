import { Component } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';

@Component({
  selector: 'app-stock-analysis',
  imports: [AnalysisOverviewComponent,WinnerOverviewComponent],
  templateUrl: 'stock-analysis.component.html',
  styleUrl: 'stock-analysis.component.css',
  standalone:true
})
export class StockAnalysisComponent {

}
