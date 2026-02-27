import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth.service';
import { JwtHelperService } from '@auth0/angular-jwt';

export const authGuard: CanActivateFn = () => {
  debugger;
  const authService = inject(AuthService);
  const jwtHelper = new JwtHelperService();

  const token = localStorage.getItem('token');

  if (!token || token.split('.').length !== 3 || jwtHelper.isTokenExpired(token))
    authService.openLogin();
  else
    return true;

  return false;
};