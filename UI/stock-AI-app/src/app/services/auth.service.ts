import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  showLoginPopup = false;

  openLogin() {
    this.showLoginPopup = true;
  }

  closeLogin() {
    this.showLoginPopup = false;
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }
}