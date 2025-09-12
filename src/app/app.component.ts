import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WebSocketService } from './services/websocket.service';
import { AuthService } from './services/auth/auth.service';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
import { FriendsWidgetComponent } from './components/friends-widget/friends-widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FriendsWidgetComponent],
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
  friendResponse: {
    username: string;
    accepted: boolean;
    message: string;
  } | null = null;
  isClosing = false;
  isFriendResponseClosing = false;
  private closingTimeout: any;
  private friendResponseTimeout: any;

  constructor(private wsService: WebSocketService, private http: HttpClient, private authService: AuthService) {}

  ngOnInit(): void {
    this.setupWebSocketSubscriptions();
    // Only connect WebSocket if user is authenticated
    if (this.authService.isAuthenticated()) {
      this.wsService.connect();
    }
  }

  private setupWebSocketSubscriptions(): void {
    this.wsService.invites$.subscribe((invite) => {
      if (invite?.initiatorUserName) {
        this.showInvite(invite);
      }
    });


    this.wsService.friendResponse$.subscribe((response) => {
      if (response?.username) {
        this.showFriendResponse(response);
      }
    });
  }

  private showInvite(invite: any): void {
    if (this.closingTimeout) {
      clearTimeout(this.closingTimeout);
      this.closingTimeout = null;
    }
    
    this.isClosing = false;
    this.pendingInvite = invite;
    
    this.closingTimeout = setTimeout(() => {
      this.dismissInvite();
    }, 30000);
  }

  private dismissInvite(): void {
    if (!this.pendingInvite) return;
    
    this.isClosing = true;
    
    setTimeout(() => {
      this.pendingInvite = null;
      this.isClosing = false;
      
      if (this.closingTimeout) {
        clearTimeout(this.closingTimeout);
        this.closingTimeout = null;
      }
    }, 300); 
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


  private showFriendResponse(response: any): void {
    if (this.friendResponseTimeout) {
      clearTimeout(this.friendResponseTimeout);
      this.friendResponseTimeout = null;
    }
    
    this.isFriendResponseClosing = false;
    this.friendResponse = response;
    
    this.friendResponseTimeout = setTimeout(() => {
      this.dismissFriendResponse();
    }, 5000);
  }

  private dismissFriendResponse(): void {
    if (!this.friendResponse) return;
    
    this.isFriendResponseClosing = true;
    
    setTimeout(() => {
      this.friendResponse = null;
      this.isFriendResponseClosing = false;
      
      if (this.friendResponseTimeout) {
        clearTimeout(this.friendResponseTimeout);
        this.friendResponseTimeout = null;
      }
    }, 300);
  }

  dismissFriendResponseManually(): void {
    this.dismissFriendResponse();
  }
}
