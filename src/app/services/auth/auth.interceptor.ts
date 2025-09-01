import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  
  // console.log('Auth interceptor processing request to:', req.url);
  // console.log('User authenticated:', authService.isAuthenticated());
  
  // Clone the request and add the authorization header if user is authenticated
  if (authService.isAuthenticated()) {
    const token = authService.getToken();
    // console.log('Adding Authorization header with token:', token ? token.substring(0, 20) + '...' : 'null');
    
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    
    // console.log('Request headers after auth interceptor:', authReq.headers);
    return next(authReq);
  }
  
  // console.log('No auth header added - user not authenticated');
  return next(req);
};
