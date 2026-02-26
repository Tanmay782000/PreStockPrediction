import { Routes } from '@angular/router';
import { CountrySelectionComponent } from './steps/country-selection/country-selection.component';
import { TermAnalysisComponent } from './steps/term-analysis/term-analysis.component';
import { CategoryAnalysisComponent } from './steps/category-analysis/category-analysis.component';
import { Component } from '@angular/core';
import { SectorAnalysisComponent } from './steps/sector-analysis/sector-analysis.component';
import { StockAnalysisComponent } from './steps/stock-analysis/stock-analysis.component';

export const routes: Routes = [
        {path:'', component: CountrySelectionComponent},
        {path:'term-analysis', component:TermAnalysisComponent},
        {path:'category-analysis', component:CategoryAnalysisComponent},
        {path:'sector-analysis', component:SectorAnalysisComponent},
        {path:'stock-analysis', component:StockAnalysisComponent}
];
