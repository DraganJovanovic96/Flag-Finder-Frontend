import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UserInfo {
  userName: string;
  numberOfWonGame?: number;
  accuracyPercentage?: number;
  averageTime?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUserInfo(userName: string): Observable<UserInfo> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    const payload = { userName };
    const url = `${this.apiUrl}games/user/info`;
    
    console.log('[UserService] Making request to:', url);
    console.log('[UserService] Request payload:', payload);
    console.log('[UserService] Request headers:', headers);

    // The auth interceptor should automatically add the Authorization header
    return this.http.post<UserInfo>(url, payload, { headers }).pipe(
      tap((response: any) => {
        console.log('[UserService] Response received for', userName, ':', response);
        // Add userName to response since backend doesn't return it
        if (response && !response.userName) {
          response.userName = userName;
        }
      }),
      catchError((error: any) => {
        console.error('[UserService] Error for', userName, ':', error);
        console.error('[UserService] Error status:', error.status);
        console.error('[UserService] Error body:', error.error);
        console.error('[UserService] Full error object:', JSON.stringify(error, null, 2));
        throw error;
      })
    );
  }
}
