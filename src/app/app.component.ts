import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WebSocketService } from './services/websocket.service';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  @ViewChild('inviteModal') inviteModalRef?: ElementRef;
  
  title = 'Flag Finder';
  pendingInvite: { 
    initiatorUserName: string; 
    targetUserName: string; 
    gameId: string;
  } | null = null;
  isClosing = false;
  private closingTimeout: any;

  constructor(private wsService: WebSocketService, private http: HttpClient) {
    this.wsService.invites$.subscribe((invite) => {
      if (invite?.initiatorUserName) {
        this.showInvite(invite);
      }
    });
  }

  ngOnInit(): void {
    this.wsService.connect();
  }

  private showInvite(invite: any): void {
    // Clear any pending timeouts
    if (this.closingTimeout) {
      clearTimeout(this.closingTimeout);
      this.closingTimeout = null;
    }
    
    this.isClosing = false;
    this.pendingInvite = invite;
    
    // Auto-dismiss after 30 seconds if user doesn't respond
    this.closingTimeout = setTimeout(() => {
      this.dismissInvite();
    }, 30000);
  }

  private dismissInvite(): void {
    if (!this.pendingInvite) return;
    
    this.isClosing = true;
    
    // Wait for the slide-out animation to complete before removing the invite
    setTimeout(() => {
      this.pendingInvite = null;
      this.isClosing = false;
      
      if (this.closingTimeout) {
        clearTimeout(this.closingTimeout);
        this.closingTimeout = null;
      }
    }, 300); // Match this with the CSS animation duration
  }

  acceptInvite(): void {
    if (!this.pendingInvite) return;
    
    const roomId = this.pendingInvite.gameId;
    const headers = new HttpHeaders().set('Content-Type', 'application/json').set('Accept', '*/*');
    
    this.http.post(`${environment.apiUrl}rooms/join`, { roomId }, { headers }).subscribe({
      next: () => {
        this.dismissInvite();
        window.location.href = `/room/${roomId}`;
      },
      error: () => {
        this.dismissInvite();
      }
    });
  }

  declineInvite(): void {
    this.dismissInvite();
  }
}
