import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WebSocketService } from '../../services/websocket.service';
import { AuthService } from '../../services/auth/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-friends-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './friends-widget.component.html',
  styleUrls: ['./friends-widget.component.scss']
})
export class FriendsWidgetComponent implements OnInit, OnDestroy {
  isOpen = false;
  activeTab: 'friends' | 'requests' | 'add' = 'friends';
  
  friends: any[] = [];
  friendRequests: any[] = [];
  newFriendUsername: string = '';
  isLoading = false;
  error = '';
  notification = '';
  private notificationTimeout: any;
  confirmDialog: {
    show: boolean;
    friendName: string;
  } = { show: false, friendName: '' };
  
  private friendRequestSub?: Subscription;
  private friendResponseSub?: Subscription;
  private friendRemovedSub?: Subscription;
  private refreshInterval?: any;

  constructor(
    private http: HttpClient,
    private webSocketService: WebSocketService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.loadFriends();
      this.loadFriendRequests();
      this.setupWebSocketListeners();
      this.startAutoRefresh();
    }
  }

  ngOnDestroy(): void {
    this.friendRequestSub?.unsubscribe();
    this.friendResponseSub?.unsubscribe();
    this.friendRemovedSub?.unsubscribe();
    this.stopAutoRefresh();
  }

  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      if (this.authService.isAuthenticated() && this.isOpen) {
        this.loadFriends();
      }
    }, 3000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private setupWebSocketListeners(): void {
    this.friendRequestSub = this.webSocketService.friendRequest$.subscribe((data) => {
      if (data) {
        this.loadFriendRequests();
        this.loadFriends();
        this.showNotification(`Friend request from ${data.senderUsername}`);
      }
    });

    this.friendResponseSub = this.webSocketService.friendResponse$.subscribe((data) => {
      if (data) {
        this.loadFriends();
        this.loadFriendRequests();
        const message = data.action === 'ACCEPTED' ? 
          `${data.senderUsername} accepted your friend request!` : 
          `${data.senderUsername} declined your friend request`;
        this.showNotification(message);
      }
    });

    this.friendRemovedSub = this.webSocketService.friendRemoved$.subscribe((data) => {
      if (data) {
        this.loadFriends();
        this.showNotification(`${data.senderUsername} removed you from their friends list`);
      }
    });
  }

  private showNotification(message: string): void {
    this.notification = message;
    
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    this.notificationTimeout = setTimeout(() => {
      this.notification = '';
    }, 5000);
  }

  toggleWidget(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.authService.isAuthenticated()) {
      this.loadFriends();
      this.loadFriendRequests();
      if (!this.friendRequestSub || !this.friendResponseSub || !this.friendRemovedSub) {
        this.setupWebSocketListeners();
      }
      if (!this.refreshInterval) {
        this.startAutoRefresh();
      }
    } else {
      this.stopAutoRefresh();
    }
  }

  setActiveTab(tab: 'friends' | 'requests' | 'add'): void {
    this.activeTab = tab;
    this.error = '';
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*')
      .set('Authorization', `Bearer ${token}`);
  }

  loadFriends(): void {
    this.http.get(`${environment.apiUrl}friends?page=0&pageSize=50`, { headers: this.getHeaders() })
      .subscribe({
        next: (data: any) => {
          const currentUserName = this.authService.getCurrentUserGameName();
          this.friends = (data || []).map((friendship: any) => {
            const friendName = friendship.initiatorUserName === currentUserName 
              ? friendship.targetUserName 
              : friendship.initiatorUserName;
            
            return {
              ...friendship,
              friendName: friendName,
              isOnline: friendship.isOnline || friendship.online || false
            };
          });
        },
        error: (err) => {
          this.error = `Failed to load friends: ${err.status} ${err.statusText}`;
        }
      });
  }

  loadFriendRequests(): void {
    this.http.get(`${environment.apiUrl}friends/requests?page=0&pageSize=50`, { headers: this.getHeaders() })
      .subscribe({
        next: (data: any) => {
          this.friendRequests = data || [];
        },
        error: (err) => {
          this.error = `Failed to load friend requests: ${err.status} ${err.statusText}`;
        }
      });
  }

  sendFriendRequest(): void {
    if (!this.newFriendUsername.trim()) {
      this.error = 'Please enter a username';
      return;
    }

    this.isLoading = true;
    this.error = '';

    const requestData = {
      userName: this.newFriendUsername.trim()
    };

    this.http.post(`${environment.apiUrl}friends/send-friend-request`, requestData, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.newFriendUsername = '';
          this.isLoading = false;
          this.setActiveTab('friends');
        },
        error: (err) => {
          this.isLoading = false;
          this.error = err.error?.message || 'Failed to send friend request';
        }
      });
  }

  respondToRequest(senderUsername: string, accepted: boolean): void {
    if (!senderUsername) {
      this.error = 'Invalid friend request data';
      return;
    }

    const responseData = {
      initiatorUserName: senderUsername,
      friendshipStatus: accepted ? 'ACCEPTED' : 'DECLINE'
    };

    this.http.put(`${environment.apiUrl}friends/friend-request-response`, responseData, { headers: this.getHeaders() })
      .subscribe({
        next: (response) => {
          this.loadFriendRequests();
          this.loadFriends();
          
          if (accepted) {
            this.setActiveTab('friends');
          }
        },
        error: (err) => {
          this.error = `Failed to respond to friend request: ${err.status} - ${err.error?.message || err.statusText}`;
        }
      });
  }

  removeFriend(friendUsername: string): void {
    if (!friendUsername) {
      this.error = 'Invalid friend data';
      return;
    }

    this.confirmDialog = {
      show: true,
      friendName: friendUsername
    };
  }

  confirmRemoveFriend(): void {
    const friendUsername = this.confirmDialog.friendName;
    this.confirmDialog = { show: false, friendName: '' };

    this.http.delete(`${environment.apiUrl}friends/${encodeURIComponent(friendUsername)}`, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.loadFriends();
        },
        error: (err) => {
          this.error = `Failed to remove friend: ${err.status} - ${err.error?.message || err.statusText}`;
        }
      });
  }

  cancelRemoveFriend(): void {
    this.confirmDialog = { show: false, friendName: '' };
  }

  inviteToGame(friendName: string): void {
    if (!friendName) {
      this.error = 'Invalid friend data';
      return;
    }

    this.http.post<any>(`${environment.apiUrl}rooms/create`, {}, { headers: this.getHeaders() })
      .subscribe({
        next: (roomResponse) => {
          const inviteRequest = {
            friendUserName: friendName
          };
          
          this.http.post(`${environment.apiUrl}rooms/invite`, inviteRequest, { headers: this.getHeaders() })
            .subscribe({
              next: (inviteResponse) => {
                this.showNotification(`Game invite sent to ${friendName}!`);
                window.location.href = `/room/${roomResponse.id}`;
              },
              error: (err) => {
                this.error = `Failed to send invite: ${err.error?.message || err.statusText}`;
              }
            });
        },
        error: (err) => {
          if (err.status === 409) {
            this.error = 'You already have an active room. Please leave it first.';
          } else {
            this.error = `Failed to create room: ${err.error?.message || err.statusText}`;
          }
        }
      });
  }

  clearError(): void {
    this.error = '';
  }
}
