import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoginComponent } from '../login/login.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule,LoginComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  standalone: true
})
export class HeaderComponent {
  public isOpen:boolean = false;
  constructor(public authService: AuthService){}
  openPopup()
  {
    this.authService.openLogin();
  }
  closePopup() {
  this.authService.closeLogin();
}
}
