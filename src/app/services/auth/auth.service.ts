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
        // console.log('Login response received:', res);
        if (res.access_token) {
          // console.log('Storing access token as session cookie:', res.access_token.substring(0, 20) + '...');
          this.cookieService.setSessionCookie('access_token', res.access_token);
          if (res.refresh_token) {
            // console.log('Storing refresh token as long-lived cookie:', res.refresh_token.substring(0, 20) + '...');
            this.cookieService.setCookie('refresh_token', res.refresh_token, false); // 30 days
          }
          // console.log('Token stored in cookies, redirecting to create-room');
          this.router.navigate(['/create-room']);
          return true;
        }
        return false;
      }),
      catchError((error) => {
        console.error('Login error:', error);
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    // console.log('Logging out user');
    
    // Call backend logout endpoint
    const headers = this.createAuthorizationHeader();
    this.http.post(`${BASIC_URL}auth/logout`, {}, { headers }).subscribe({
      next: () => {
        // console.log('Server logout successful');
      },
      error: (error) => {
        console.error('Server logout failed:', error);
        // Continue with local cleanup even if server call fails
      },
      complete: () => {
        // Always clean up locally regardless of server response
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
    // console.log('Checking authentication, token present in cookie:', isAuth);
    return isAuth;
  }

  getToken(): string | null {
    const token = this.cookieService.getCookie('access_token');
    // console.log('Getting token from cookie, present:', !!token);
    if (token) {
      // console.log('Token preview:', token.substring(0, 20) + '...');
    }
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
      console.log('No token found');
      return 'drgghouse'; // Fallback for now
    }
    
    try {
      // Decode JWT token to get user info
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('JWT payload:', payload);
      console.log('Available fields:', Object.keys(payload));
      
      // Try different possible fields for username
      const username = payload.sub || payload.username || payload.email || payload.gameName || '';
      console.log('Extracted username:', username);
      
      // If no username found, return fallback
      if (!username) {
        console.log('No username found in token, using fallback');
        return 'drgghouse';
      }
      
      return username;
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return 'drgghouse'; // Fallback for now
    }
  }
}
