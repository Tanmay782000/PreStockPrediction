import { Component, OnInit } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';
import { TermService } from '../../services/term.service';
import { CountryService } from '../../services/country.service';
import { switchMap } from 'rxjs';
import { NiftyService } from '../../services/nifty.service';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-term-analysis',
  imports: [
    AnalysisOverviewComponent,
    WinnerOverviewComponent,
    WizardActionsComponent,
  ],
  templateUrl: './term-analysis.component.html',
  styleUrl: './term-analysis.component.css',
  standalone: true,
})
export class TermAnalysisComponent implements OnInit {
  public title1: any = 'Terms Probability';
  public title2: any = 'Terms Summery';
  public summery: any = '';
  public termArray: number[] = [];
  public fixArray: any[] = ['Short Term', 'Mid Term', 'Long Term'];
  public finalArray: any[] = [];
  public niftyArray:any[] = [];
  constructor(
    private termService: TermService,
    private countryService: CountryService,
    private niftyService: NiftyService,
    private dataService:DataService
  ) {}
  ngOnInit(): void {
    const countryId = this.countryService.getSelectedCurrentCountry();
    if (countryId != 0) {
      this.termService
        .getTermAnalysis(countryId)
        .pipe(
          switchMap((res: any) => {
            console.log("This call first")
            this.termArray = res.termAnalysis.probabilityArr;
            this.summery = res.termAnalysis.summary;
            this.finalArray = this.termArray;
            return this.niftyService.getNiftyAnalysis(countryId);
          }),
        )
        .subscribe({
          next: (res2) => {
            console.log("This call second")
            this.niftyArray = res2.niftyPrediction
            this.dataService.setData(this.niftyArray);
          },
          error: (err) => console.log(err),
        });
    }
  }
}
