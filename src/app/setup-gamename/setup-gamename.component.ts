import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../services/auth/auth.service';
import { WebSocketService } from '../services/websocket.service';
import { environment } from '../../environments/environment';

const BASIC_URL = environment.apiUrl;

@Component({
  selector: 'app-setup-gamename',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup-gamename.component.html',
  styleUrls: ['./setup-gamename.component.scss']
})
export class SetupGameNameComponent implements OnInit {
  currentGameName = '';
  newGameName = '';
  isAvailable = false;
  isChecking = false;
  isSubmitting = false;
  errorMessage = '';
  token = '';
  refreshToken = '';
  
  private checkTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      this.refreshToken = params['refreshToken'];
      const currentGameName = params['currentGameName'];
      
      if (!this.token || !this.refreshToken) {
        this.router.navigate(['/login']);
        return;
      }
      
      if (currentGameName) {
        this.currentGameName = decodeURIComponent(currentGameName);
      }
    });
  }

  get isValidFormat(): boolean {
    return /^[a-zA-Z0-9_]*$/.test(this.newGameName);
  }

  get canUpdate(): boolean {
    return this.newGameName.length >= 3 && 
           this.newGameName.length <= 20 && 
           this.isValidFormat && 
           this.isAvailable && 
           !this.isChecking &&
           this.newGameName !== this.currentGameName;
  }

  onGameNameChange(): void {
    this.errorMessage = '';
    
    if (this.checkTimeout) {
      clearTimeout(this.checkTimeout);
    }

    if (this.newGameName.length >= 3 && this.isValidFormat && this.newGameName !== this.currentGameName) {
      this.checkTimeout = setTimeout(() => {
        this.checkAvailability();
      }, 500);
    } else {
      this.isAvailable = false;
    }
  }

  checkAvailability(): void {
    if (this.newGameName.length < 3 || !this.isValidFormat || this.newGameName === this.currentGameName) {
      return;
    }

    this.isChecking = true;
    
    const headers = new HttpHeaders()
      .set('Authorization', `Bearer ${this.token}`)
      .set('Content-Type', 'application/json');

    const url = `${BASIC_URL}gamename/check/${this.newGameName}`;

    this.http.get<{available: boolean}>(url, { headers })
      .subscribe({
        next: (response) => {
          this.isAvailable = response.available;
          this.isChecking = false;
        },
        error: (error) => {
          this.isChecking = false;
          this.isAvailable = false;
        }
      });
  }

  updateGameName(): void {
    if (!this.canUpdate) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const headers = new HttpHeaders()
      .set('Authorization', `Bearer ${this.token}`)
      .set('Content-Type', 'application/json');

    const request = { gameName: this.newGameName };

    this.http.post<any>(`${BASIC_URL}gamename/set`, request, { headers })
      .subscribe({
        next: (response) => {
          this.authService.storeTokens(response.access_token, response.refresh_token);
          this.wsService.connect();
          this.router.navigate(['/home']);
        },
        error: (error) => {
          this.errorMessage = error.error?.error || 'Failed to update game name';
          this.isSubmitting = false;
        }
      });
  }

  skipCustomization(): void {
    this.isSubmitting = true;
    
    const headers = new HttpHeaders()
      .set('Authorization', `Bearer ${this.token}`)
      .set('Content-Type', 'application/json');

    const request = { gameName: this.currentGameName };

    this.http.post<any>(`${BASIC_URL}gamename/set`, request, { headers })
      .subscribe({
        next: (response) => {
          this.authService.storeTokens(response.access_token, response.refresh_token);
          this.wsService.connect();
          this.router.navigate(['/home']);
        },
        error: (error) => {
          this.authService.storeTokens(this.token, this.refreshToken);
          this.wsService.connect();
          this.router.navigate(['/home']);
        }
      });
  }
}
