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
  pendingFriendRequest: {
    senderUsername: string;
    message: string;
  } | null = null;
  friendResponse: {
    username: string;
    accepted: boolean;
    message: string;
  } | null = null;
  isClosing = false;
  isFriendRequestClosing = false;
  isFriendResponseClosing = false;
  private closingTimeout: any;
  private friendRequestTimeout: any;
  private friendResponseTimeout: any;

  constructor(private wsService: WebSocketService, private http: HttpClient) {
    this.wsService.invites$.subscribe((invite) => {
      if (invite?.initiatorUserName) {
        this.showInvite(invite);
      }
    });

    this.wsService.friendRequest$.subscribe((request) => {
      if (request?.senderUsername) {
        this.showFriendRequest(request);
      }
    });

    this.wsService.friendResponse$.subscribe((response) => {
      if (response?.username) {
        this.showFriendResponse(response);
      }
    });
  }

  ngOnInit(): void {
    this.wsService.connect();
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

  private showFriendRequest(request: any): void {
    if (this.friendRequestTimeout) {
      clearTimeout(this.friendRequestTimeout);
      this.friendRequestTimeout = null;
    }
    
    this.isFriendRequestClosing = false;
    this.pendingFriendRequest = request;
    
    this.friendRequestTimeout = setTimeout(() => {
      this.dismissFriendRequest();
    }, 30000);
  }

  private dismissFriendRequest(): void {
    if (!this.pendingFriendRequest) return;
    
    this.isFriendRequestClosing = true;
    
    setTimeout(() => {
      this.pendingFriendRequest = null;
      this.isFriendRequestClosing = false;
      
      if (this.friendRequestTimeout) {
        clearTimeout(this.friendRequestTimeout);
        this.friendRequestTimeout = null;
      }
    }, 300);
  }

  acceptFriendRequest(): void {
    if (!this.pendingFriendRequest) return;
    
    const headers = new HttpHeaders().set('Content-Type', 'application/json').set('Accept', '*/*');
    
    this.http.post(`${environment.apiUrl}friends/respond`, {
      senderUsername: this.pendingFriendRequest.senderUsername,
      accepted: true
    }, { headers }).subscribe({
      next: () => {
        this.dismissFriendRequest();
      },
      error: () => {
        this.dismissFriendRequest();
      }
    });
  }

  declineFriendRequest(): void {
    if (!this.pendingFriendRequest) return;
    
    const headers = new HttpHeaders().set('Content-Type', 'application/json').set('Accept', '*/*');
    
    this.http.post(`${environment.apiUrl}friends/respond`, {
      senderUsername: this.pendingFriendRequest.senderUsername,
      accepted: false
    }, { headers }).subscribe({
      next: () => {
        this.dismissFriendRequest();
      },
      error: () => {
        this.dismissFriendRequest();
      }
    });
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
