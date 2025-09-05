import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CookieService } from './cookie.service';

const BASIC_URL = environment.apiUrl;

interface AuthResponse {
  access_token: string;
  refresh_token: string;
}

interface UserResponse {
  firstname: string;
  lastname: string;
  imageUrl: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private http: HttpClient,
    private router: Router,
    private cookieService: CookieService
  ) { }

  login(email: string, password: string): Observable<any> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json')
      .set('Accept', '*/*');
    const body = { email, password };
    
    return this.http.post<AuthResponse>(BASIC_URL + 'auth/authenticate', body, { headers }).pipe(
      map((res) => {
        if (res.access_token) {
          this.cookieService.setSessionCookie('access_token', res.access_token);
          if (res.refresh_token) {
            this.cookieService.setCookie('refresh_token', res.refresh_token, false); // 30 days
          }
          this.router.navigate(['/home']);
          return true;
        }
        return false;
      }),
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    const headers = this.createAuthorizationHeader();
    this.http.post(`${BASIC_URL}auth/logout`, {}, { headers }).subscribe({
      next: () => {
      },
      error: (error) => {
      },
      complete: () => {
        this.cookieService.removeCookie('access_token');
        this.cookieService.removeCookie('refresh_token');
        this.cookieService.removeCookie('user');
        this.router.navigate(['/login']);
      }
    });
  }

  isAuthenticated(): boolean {
    const token = this.cookieService.getCookie('access_token');
    const isAuth = !!token;
    return isAuth;
  }

  getToken(): string | null {
    const token = this.cookieService.getCookie('access_token');
    return token;
  }

  getRefreshToken(): string | null {
    return this.cookieService.getCookie('refresh_token');
  }

  refreshToken(): Observable<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const headers = new HttpHeaders().set('Refresh', `Bearer ${refreshToken}`);

    return this.http.post<AuthResponse>(`${BASIC_URL}auth/refresh-token`, {}, { headers }).pipe(
      map((res) => {
        if (res.access_token) {
          this.cookieService.setSessionCookie('access_token', res.access_token);
          return res.access_token;
        }
        throw new Error('Failed to refresh token');
      }),
      catchError((err) => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  createAuthorizationHeader(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  getCurrentUserGameName(): string {
    const token = this.getToken();
    if (!token) {
      return 'none';
    }
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const username = payload.gameName || payload.sub || payload.username || payload.email || '';
      if (!username) {
        return 'drgghouse';
      }
      
      return username;
    } catch (error) {
      return 'none';
    }
  }
}
