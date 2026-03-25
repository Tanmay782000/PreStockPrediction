import { Component } from '@angular/core';
import { DataService } from '../../services/data.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-stock-details',
  imports: [],
  templateUrl: './stock-details.component.html',
  styleUrl: './stock-details.component.css',
})
export class StockDetailsComponent {
  constructor(
    private dataservice: DataService,
    private activatedroute: ActivatedRoute,
  ) {}
  public final_array: any = null;
  ngOnInit() {
    const id = this.activatedroute.snapshot.paramMap.get('id');
    let stockData = this.dataservice.repeatativeData();
    if (!stockData) {
      console.log('Data not loaded yet');
      return;
    }
    var data = stockData.find((x: any) => Number(x.stockId) === Number(id));
    if (data) {
      this.final_array = data;
    }
  }

  toJson(data: any) {
  return JSON.stringify(data);
}
}
