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
      if (error.status === 401) {
        const url = error.url || '';
        
        if (!url.includes('/auth/') && !url.includes('/login')) {
          authService.logout();
          router.navigate(['/login']);
        }
      }
      
      return throwError(() => error);
    })
  );
};
