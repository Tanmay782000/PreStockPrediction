import { Component } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';
import { StockService } from '../../services/stock.service';
import { CountryService } from '../../services/country.service';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-stock-analysis',
  imports: [
    AnalysisOverviewComponent,
    WinnerOverviewComponent,
    WizardActionsComponent,
  ],
  templateUrl: 'stock-analysis.component.html',
  styleUrl: 'stock-analysis.component.css',
  standalone: true,
})
export class StockAnalysisComponent {
  public title1: any = 'Stocks Probability';
  public title2: any = 'Stocks Summery';
  public summery: any = '';
  public stockArray: number[] = [];
  public fixArray: any[] = [
    'Information Technology',
    'Financials',
    'Healthcare / Pharmaceuticals',
    'Consumer Discretionary',
    'Consumer Staples',
    'Industrials',
    'Energy',
    'Materials',
    'Utilities',
    'Real Estate',
  ];
  public finalArray: any[] = [];
  public niftyArray: any[] = [];
  constructor(
    private stockService: StockService,
    private countryService: CountryService,
    private dataService: DataService
  ) {}
  ngOnInit(): void {
    const countryId = this.countryService.getSelectedCurrentCountry();
    if (countryId != 0) {
      this.stockService.getStockAnalysis(countryId).subscribe(
        (res) => {
          console.log('ysysysys', res);
          this.stockArray = res.stockAnalysis;
          this.finalArray = this.stockArray;
          this.niftyArray = this.dataService.apiData()
        },
        (err) => {
          console.log(err);
        },
      );
    }
  }
}
