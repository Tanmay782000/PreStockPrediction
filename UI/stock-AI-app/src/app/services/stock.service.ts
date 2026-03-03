import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StockService {
  private baseUrl =
    'https://d4guxgoca0.execute-api.ap-south-1.amazonaws.com/dev/';
  constructor(private http: HttpClient) {}

  getStockAnalysis(countryId: any): Observable<any> {
    debugger;
    const token = localStorage.getItem('token');
    const params = new HttpParams().set('countryId', countryId);
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return this.http.get(`${this.baseUrl}showstockanalysis`, {
      headers: headers,
      params: params,
    });
  }
}
