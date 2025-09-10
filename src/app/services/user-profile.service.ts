import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth/auth.service';

const BASIC_URL = environment.apiUrl;

export interface UserProfile {
  email: string;
  gameName: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  private emailToGameNameCache = new Map<string, string>();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getCurrentUserEmail(): string {
    const token = this.authService.getToken();
    if (!token) {
      return '';
    }
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email || payload.sub || '';
    } catch (error) {
      return '';
    }
  }

  getUserProfile(email: string): Observable<UserProfile> {
    if (this.emailToGameNameCache.has(email)) {
      return of({
        email: email,
        gameName: this.emailToGameNameCache.get(email)!
      });
    }

    return this.http.get<{gameName: string}>(`${BASIC_URL}users/profile`, {
      params: { email: email },
      headers: this.authService.createAuthorizationHeader()
    }).pipe(
      map(response => {
        const profile: UserProfile = {
          email: email,
          gameName: response.gameName
        };
        this.emailToGameNameCache.set(email, response.gameName);
        return profile;
      }),
      catchError(() => {
        const fallbackGameName = email.split('@')[0];
        const fallbackProfile: UserProfile = {
          email: email,
          gameName: fallbackGameName
        };
        this.emailToGameNameCache.set(email, fallbackGameName);
        return of(fallbackProfile);
      })
    );
  }

  getUserProfiles(emails: string[]): Observable<UserProfile[]> {
    const uniqueEmails = [...new Set(emails)];
    const requests = uniqueEmails.map(email => this.getUserProfile(email));
    
    return new Observable(observer => {
      Promise.all(requests.map(req => req.toPromise()))
        .then(profiles => {
          observer.next(profiles.filter(p => p !== undefined) as UserProfile[]);
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }

  clearCache(): void {
    this.emailToGameNameCache.clear();
  }
}
