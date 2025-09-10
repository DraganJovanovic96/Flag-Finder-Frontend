import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { WebSocketService } from '../services/websocket.service';

@Component({
  selector: 'app-oauth2-callback',
  standalone: true,
  template: `
    <div class="callback-container">
      <div class="loading-spinner"></div>
      <p>Processing Google login...</p>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    p {
      font-size: 1.1rem;
      margin: 0;
    }
  `]
})
export class OAuth2CallbackComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const refreshToken = params['refreshToken'];
      
      if (token && refreshToken) {
        // Store tokens and redirect to home
        this.authService.storeTokens(token, refreshToken);
        this.wsService.connect();
        this.router.navigate(['/home']);
      } else {
        // Handle error case
        this.router.navigate(['/login'], { queryParams: { error: 'oauth2_failed' } });
      }
    });
  }
}
