import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  private _apiData = signal<any>(null);
  readonly apiData = this._apiData.asReadonly();
 
  setData(newValue:any){
    this._apiData.set(newValue);
  }
}
