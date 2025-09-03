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
    
    return this.http.post<UserInfo>(url, payload, { headers }).pipe(
      tap((response: any) => {
        if (response && !response.userName) {
          response.userName = userName;
        }
      }),
      catchError((error: any) => {
        throw error;
      })
    );
  }
}
