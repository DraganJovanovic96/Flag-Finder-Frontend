import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CookieService {
  
  setCookie(name: string, value: string, isSession: boolean = true): void {
    let cookieValue = `${name}=${value};path=/;SameSite=Strict`;
    
    if (!isSession) {
      // Only set expiration for non-session cookies (like refresh tokens)
      const expires = new Date();
      expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
      cookieValue += `;expires=${expires.toUTCString()}`;
    }
    
    document.cookie = cookieValue;
  }

  setSessionCookie(name: string, value: string): void {
    // Session cookie - expires when browser closes
    const cookieValue = `${name}=${value};path=/;SameSite=Strict`;
    document.cookie = cookieValue;
  }

  getCookie(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  removeCookie(name: string): void {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }

  clearAllCookies(): void {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      this.removeCookie(name.trim());
    }
  }
}
