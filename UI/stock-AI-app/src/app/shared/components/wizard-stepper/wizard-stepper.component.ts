import { Component, inject,OnInit } from '@angular/core';
import {FormBuilder, Validators, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatStepper } from '@angular/material/stepper';
import { ViewChild } from '@angular/core';
import { WizardService } from '../../../services/stepper.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CountryService } from '../../../services/country.service';

@Component({
  selector: 'app-wizard-stepper',
  imports: [MatStepperModule, MatButtonModule, MatInputModule, MatFormFieldModule, FormsModule, ReactiveFormsModule],
  templateUrl: './wizard-stepper.component.html',
  styleUrl: './wizard-stepper.component.css',
  standalone: true
})
export class WizardStepperComponent {

 constructor(private wizardService: WizardService,private activatedroute:ActivatedRoute, private router:Router){}

 private _formBuilder = inject(FormBuilder);
 @ViewChild(MatStepper) stepper!: MatStepper;

 ngAfterViewInit() {
  debugger;
  console.log("first");
  this.wizardService.register(this.stepper);
  // this.ngRedirectToPage()
}

  ngOnInit(): void { 
    debugger;
    console.log("second");
    // if(this.stepper != undefined)
    //   this.ngRedirectToPage()
  }

  ngRedirectToPage()
  {
  var urlSegments = this.activatedroute.snapshot.url;
  let getlast = null;
  if(urlSegments.length > 0)
    getlast = urlSegments[urlSegments.length - 1].path;
  else
    getlast = '' 

  switch(getlast)
  {
    case '':
      this.router.navigate([''])
    break;
    case 'term-analysis':
      this.router.navigate(['/term-analysis'])
    break;
    case 'category-analysis':
      this.router.navigate(['/category-analysis'])
    break;
    case 'sector-analysis': 
      this.router.navigate(['/sector-analysis'])
    break;
    case 'stock-analysis':
      this.router.navigate(['/stock-analysis'])
    break;
  }
  }


  firstFormGroup = this._formBuilder.group({
    firstCtrl: ['', Validators.required],
  });
  secondFormGroup = this._formBuilder.group({
    secondCtrl: ['', Validators.required],
  });
  thirdFormGroup = this._formBuilder.group({
    thirdCtrl: ['', Validators.required],
  });
  forthFormGroup = this._formBuilder.group({
    forthCtrl: ['', Validators.required],
  });
  fifthFormGroup = this._formBuilder.group({
    fifthCtrl: ['', Validators.required],
  });

  goNext() {
    debugger;
  this.stepper.next();

  }

  goBack() {
   this.stepper.previous();
  }
}
