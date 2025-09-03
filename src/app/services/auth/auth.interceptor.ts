import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  
  console.log('[AuthInterceptor] Processing request to:', req.url);
  console.log('[AuthInterceptor] User authenticated:', authService.isAuthenticated());
  
  // Clone the request and add the authorization header if user is authenticated
  if (authService.isAuthenticated()) {
    const token = authService.getToken();
    console.log('[AuthInterceptor] Adding Authorization header with token:', token ? token.substring(0, 20) + '...' : 'null');
    
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    
    console.log('[AuthInterceptor] Request headers after auth interceptor:', authReq.headers.keys());
    return next(authReq);
  }
  
  console.log('[AuthInterceptor] No auth header added - user not authenticated');
  return next(req);
};
