import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  private _apiData = signal<any>(null);
  readonly apiData = this._apiData.asReadonly();
 
  private _repeatativeData = signal<any>(null);
  public repeatativeData = this._repeatativeData.asReadonly();

  setRepeatativeData(newValue:any){
    this._repeatativeData.set(newValue);
  }

  setData(newValue:any){
    this._apiData.set(newValue);
  }
}
