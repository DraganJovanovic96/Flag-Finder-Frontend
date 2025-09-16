import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  imports: [CommonModule, ReactiveFormsModule],
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(private fb: FormBuilder, private router: Router) {
    this.resetForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.resetForm.get('confirmPassword')?.setValidators([
      Validators.required,
      this.passwordMatchValidator.bind(this)
    ]);
  }

  passwordMatchValidator(control: any): { [key: string]: boolean } | null {
    const newPassword = this.resetForm?.get('newPassword')?.value;
    const confirmPassword = control.value;
    
    if (newPassword !== confirmPassword) {
      return { 'passwordMismatch': true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.resetForm.valid) {
      this.successMessage = 'Password reset successfully!';
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    }
  }

  goBack(): void {
    this.router.navigate(['/login']);
  }
}
