import { Component, OnInit } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';
import { TermService } from '../../services/term.service';
import { CountryService } from '../../services/country.service';

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
  public summery: any = "";
  public termArray: number[] = [];
  public fixArray: any[] = ["Short Term", "Mid Term", "Long Term"];
  public finalArray: any[] = [];
  constructor(
    private termService: TermService,
    private countryService: CountryService,
  ) {}
  ngOnInit(): void {
    const countryId = this.countryService.getSelectedCurrentCountry();
    if (countryId != 0) {
      this.termService.getTermAnalysis(countryId).subscribe(
        (res) => {
          this.termArray = res.termAnalysis.probabilityArr;
          this.summery = res.termAnalysis.summary
          this.finalArray = this.fixArray.map((name, i) => ({
          name,
          value: Number(this.termArray[i]) * 100
          }));
        },
        (err) => {
          console.log(err);
        },
      );
    }
  }
}
