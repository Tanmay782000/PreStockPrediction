import { Component,Input } from '@angular/core';

@Component({
  selector: 'app-analysis-overview',
  imports: [],
  templateUrl: './analysis-overview.component.html',
  styleUrl: './analysis-overview.component.css',
  standalone: true
})
export class AnalysisOverviewComponent {
@Input() public title: any = "";
}
