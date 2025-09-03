import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth/auth.service';
import { WebSocketService } from '../services/websocket.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [CommonModule, ReactiveFormsModule],
})

export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private wsService: WebSocketService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    this.setupFormListeners();
  }

  private setupFormListeners(): void {
    this.loginForm.get('email')?.valueChanges.subscribe(() => {
      if (this.errorMessage) {
        this.errorMessage = null;
      }
    });

    this.loginForm.get('password')?.valueChanges.subscribe(() => {
      if (this.errorMessage) {
        this.errorMessage = null;
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;
      
      const username = this.loginForm.get('email')!.value;
      const password = this.loginForm.get('password')!.value;

      this.authService.login(username, password).subscribe({
        next: (res: any) => {
          this.wsService.connect();
          this.isLoading = false;
        },
        error: (error: any) => {
          this.isLoading = false;
          
          if (error.status === 401) {
            this.errorMessage = 'Invalid email or password.';
          } else if (error.status === 403) {
            this.errorMessage = 'Account not verified. Please check your email.';
          } else {
            this.errorMessage = 'Login failed. Please try again.';
          }
        }
      });
    }
  }
}
