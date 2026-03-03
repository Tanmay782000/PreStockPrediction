import { Component, OnInit } from '@angular/core';
import { AnalysisOverviewComponent } from '../../shared/components/analysis-overview/analysis-overview.component';
import { WinnerOverviewComponent } from '../../shared/components/winner-overview/winner-overview.component';
import { WizardActionsComponent } from '../../shared/components/wizard-actions/wizard-actions.component';
import { CountryService } from '../../services/country.service';
import { CategoryService } from '../../services/category.service';

@Component({
  selector: 'app-category-analysis',
  imports: [
    AnalysisOverviewComponent,
    WinnerOverviewComponent,
    WizardActionsComponent,
  ],
  templateUrl: './category-analysis.component.html',
  styleUrl: './category-analysis.component.css',
  standalone: true,
})
export class CategoryAnalysisComponent implements OnInit {
  public title1: any = 'Categories Probability';
  public title2: any = 'Categories Summery';
  public summery: any = '';
  public categoryArray: number[] = [];
  public fixArray: any[] = ['Nifty 50', 'Nifty Next 50', 'Nifty Midcap 150', 'Nifty SmallCap 250'];
  public finalArray: any[] = [];
  constructor(    
      private categoryService: CategoryService,
      private countryService: CountryService) {}
  ngOnInit(): void {
    debugger;
    const countryId = this.countryService.getSelectedCurrentCountry();
    if (countryId != 0) {
      this.categoryService.getCategoryAnalysis(countryId).subscribe(
        (res) => {
          this.categoryArray = res.categoryAnalysis.probabilityArr;
          this.summery = res.categoryAnalysis.summary
          this.finalArray = this.fixArray.map((name, i) => ({
          name,
          value: Number(this.categoryArray[i]) * 100
          }));
        },
        (err) => {
          console.log(err);
        },
      );
    }
  }
}
