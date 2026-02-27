import { Routes } from '@angular/router';
import { CountrySelectionComponent } from './steps/country-selection/country-selection.component';
import { TermAnalysisComponent } from './steps/term-analysis/term-analysis.component';
import { CategoryAnalysisComponent } from './steps/category-analysis/category-analysis.component';
import { Component } from '@angular/core';
import { SectorAnalysisComponent } from './steps/sector-analysis/sector-analysis.component';
import { StockAnalysisComponent } from './steps/stock-analysis/stock-analysis.component';
import { authGuard } from './services/gaurds/auth.guard';

export const routes: Routes = [
        {path:'', component: CountrySelectionComponent},
        {path:'term-analysis', component:TermAnalysisComponent,canActivate: [authGuard]},
        {path:'category-analysis', component:CategoryAnalysisComponent,canActivate: [authGuard]},
        {path:'sector-analysis', component:SectorAnalysisComponent,canActivate: [authGuard]},
        {path:'stock-analysis', component:StockAnalysisComponent,canActivate: [authGuard]}
];
