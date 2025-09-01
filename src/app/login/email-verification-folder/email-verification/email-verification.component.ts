import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  templateUrl: './email-verification.component.html',
  styleUrls: ['./email-verification.component.scss'],
  imports: [CommonModule],
})
export class EmailVerificationComponent implements OnInit {
  verificationStatus: 'verifying' | 'success' | 'error' = 'verifying';
  errorMessage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Simulate email verification process
    setTimeout(() => {
      this.verificationStatus = 'success';
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 3000);
    }, 2000);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
