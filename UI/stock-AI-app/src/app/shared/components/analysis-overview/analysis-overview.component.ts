import { Component,Input } from '@angular/core';
import { ProgressBarModule } from 'primeng/progressbar';

@Component({
  selector: 'app-analysis-overview',
  imports: [ProgressBarModule],
  templateUrl: './analysis-overview.component.html',
  styleUrl: './analysis-overview.component.css',
  standalone: true
})
export class AnalysisOverviewComponent {
@Input() public title1: any = "";
@Input() public title2: any = "";
@Input() public finalArray: any[] = [];
@Input() public summery: any = "";
}
