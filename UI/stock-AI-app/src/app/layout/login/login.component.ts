import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  standalone:true
})
export class LoginComponent {
  @Output() close = new EventEmitter<void>();
  tokenValue:string = "";

  Login(){
    if(this.tokenValue!=null)
      localStorage.setItem("token",this.tokenValue);
  }
}
