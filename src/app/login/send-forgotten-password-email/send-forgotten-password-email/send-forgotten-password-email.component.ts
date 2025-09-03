import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-send-forgotten-password-email',
  standalone: true,
  templateUrl: './send-forgotten-password-email.component.html',
  styleUrls: ['./send-forgotten-password-email.component.scss'],
  imports: [CommonModule, ReactiveFormsModule],
})
export class SendForgottenPasswordEmail {
  emailForm: FormGroup;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(private fb: FormBuilder, private router: Router) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.emailForm.valid) {
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
