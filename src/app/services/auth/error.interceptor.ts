import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // console.log('Error interceptor caught error:', error.status, error.url);
      
      // Only auto-logout on 401 errors for specific endpoints that should require authentication
      if (error.status === 401) {
        const url = error.url || '';
        
        // Don't auto-logout for login/authentication endpoints
        if (!url.includes('/auth/') && !url.includes('/login')) {
          // console.log('Auto-logout due to 401 error on protected endpoint');
          authService.logout();
          router.navigate(['/login']);
        }
      }
      
      return throwError(() => error);
    })
  );
};
