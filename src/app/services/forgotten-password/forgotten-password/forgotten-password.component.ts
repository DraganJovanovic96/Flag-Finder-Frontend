import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgotten-password',
  standalone: true,
  templateUrl: './forgotten-password.component.html',
  styleUrls: ['./forgotten-password.component.scss'],
  imports: [CommonModule, ReactiveFormsModule],
})
export class ForgottenPasswordComponent {
  forgotForm: FormGroup;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(private fb: FormBuilder, private router: Router) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.forgotForm.valid) {
      // Here you would typically call your API to send reset email
      this.successMessage = 'If an account with that email exists, a password reset link has been sent.';
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 3000);
    }
  }

  goBack(): void {
    this.router.navigate(['/login']);
  }
}
