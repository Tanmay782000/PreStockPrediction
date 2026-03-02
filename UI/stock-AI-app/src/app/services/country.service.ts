import { HttpClient, HttpParams, HttpHeaders} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CountryService {
  private baseUrl = 'https://d4guxgoca0.execute-api.ap-south-1.amazonaws.com/dev/';

  //#region INTERNAL
  private getCurrentCountry = new BehaviorSubject<any>(0);
  getCurrCountry$ =this.getCurrentCountry.asObservable();
  //#endregion

  constructor(private http: HttpClient) { }

  getCountry(countryId:number):Observable<any>
  {
    debugger;
    const token = localStorage.getItem('token');
    const params = new HttpParams()
    .set('countryId', countryId.toString());
    const headers = new HttpHeaders({
      'Authorization':`Bearer ${token}`
    })
  return this.http.get(`${this.baseUrl}country`, {
  headers: headers,
  params: params
});
  }

  setSelectedCurrentCountry(countryId:any)
  {
    debugger;
    this.getCurrentCountry.next(countryId);
  }

  getSelectedCurrentCountry()
  {
    debugger;
    return this.getCurrentCountry.getValue()
  }
}
