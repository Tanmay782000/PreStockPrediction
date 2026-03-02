import { Component } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';
import { SectorService } from '../../services/sector.service';
import { CountryService } from '../../services/country.service';

@Component({
  selector: 'app-sector-analysis',
  imports: [AnalysisOverviewComponent,WinnerOverviewComponent,WizardActionsComponent],
  templateUrl: './sector-analysis.component.html',
  styleUrl: './sector-analysis.component.css',
  standalone:true
})
export class SectorAnalysisComponent {
public title1: any = 'Sectors Probability';
  public title2: any = 'Sectors Summery';
  public summery: any = "";
  public sectorArray: number[] = [];
  public fixArray: any[] = ["Information Technology", "Financials", "Healthcare / Pharmaceuticals", "Consumer Discretionary", "Consumer Staples", "Industrials", "Energy", "Materials", "Utilities", "Real Estate"];
  public finalArray: any[] = [];
  constructor(
    private sectorService: SectorService,
    private countryService: CountryService,
  ) {}
  ngOnInit(): void {
    const countryId = this.countryService.getSelectedCurrentCountry();
    if (countryId != 0) {
      this.sectorService.getSectorAnalysis(countryId).subscribe(
        (res) => {
          this.sectorArray = res.sectorAnalysis.probabilityArr;
          this.summery = res.sectorAnalysis.summary
          this.finalArray = this.fixArray.map((name, i) => ({
          name,
          value: Number(this.sectorArray[i]) * 100
          }));
        },
        (err) => {
          console.log(err);
        },
      );
    }
  }
}
