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

  constructor(
    private http: HttpClient,
    private webSocketService: WebSocketService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Only load friends data and setup WebSocket if user is authenticated
    if (this.authService.isAuthenticated()) {
      this.loadFriends();
      this.loadFriendRequests();
      this.setupWebSocketListeners();
    }
  }

  ngOnDestroy(): void {
    this.friendRequestSub?.unsubscribe();
    this.friendResponseSub?.unsubscribe();
    this.friendRemovedSub?.unsubscribe();
  }

  private setupWebSocketListeners(): void {
    this.friendRequestSub = this.webSocketService.friendRequest$.subscribe((data) => {
      if (data) {
        console.log('Received friend request notification:', data);
        this.loadFriendRequests();
        // Also refresh friends list in case of status changes
        this.loadFriends();
        // Use the senderUsername from the notification
        this.showNotification(`Friend request from ${data.senderUsername}`);
      }
    });

    this.friendResponseSub = this.webSocketService.friendResponse$.subscribe((data) => {
      if (data) {
        console.log('Received friend response notification:', data);
        this.loadFriends();
        // Also refresh friend requests to remove processed requests
        this.loadFriendRequests();
        // Use the senderUsername from the notification (person who responded)
        const message = data.action === 'ACCEPTED' ? 
          `${data.senderUsername} accepted your friend request!` : 
          `${data.senderUsername} declined your friend request`;
        this.showNotification(message);
      }
    });

    this.friendRemovedSub = this.webSocketService.friendRemoved$.subscribe((data) => {
      if (data) {
        console.log('Received friend removed notification:', data);
        this.loadFriends();
        // Use the senderUsername from the notification (person who removed the friend)
        this.showNotification(`${data.senderUsername} removed you from their friends list`);
      }
    });
  }

  private showNotification(message: string): void {
    console.log('Friend notification:', message);
    this.notification = message;
    
    // Clear any existing timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    // Auto-hide notification after 5 seconds
    this.notificationTimeout = setTimeout(() => {
      this.notification = '';
    }, 5000);
  }

  toggleWidget(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.authService.isAuthenticated()) {
      this.loadFriends();
      this.loadFriendRequests();
      // Setup WebSocket listeners if not already done
      if (!this.friendRequestSub || !this.friendResponseSub || !this.friendRemovedSub) {
        this.setupWebSocketListeners();
      }
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
    console.log('Loading friends from:', `${environment.apiUrl}friends`);
    this.http.get(`${environment.apiUrl}friends?page=0&pageSize=50`, { headers: this.getHeaders() })
      .subscribe({
        next: (data: any) => {
          console.log('Friends loaded:', data);
          console.log('First friend object:', data[0]);
          
          const currentUserName = this.authService.getCurrentUserGameName();
          this.friends = (data || []).map((friendship: any) => {
            const friendName = friendship.initiatorUserName === currentUserName 
              ? friendship.targetUserName 
              : friendship.initiatorUserName;
            
            return {
              ...friendship,
              friendName: friendName
            };
          });
          
          console.log('Processed friends:', this.friends);
        },
        error: (err) => {
          console.error('Failed to load friends:', err);
          this.error = `Failed to load friends: ${err.status} ${err.statusText}`;
        }
      });
  }

  loadFriendRequests(): void {
    console.log('Loading friend requests from:', `${environment.apiUrl}friends/requests`);
    this.http.get(`${environment.apiUrl}friends/requests?page=0&pageSize=50`, { headers: this.getHeaders() })
      .subscribe({
        next: (data: any) => {
          console.log('Friend requests loaded:', data);
          console.log('First request object:', data[0]);
          this.friendRequests = data || [];
        },
        error: (err) => {
          console.error('Failed to load friend requests:', err);
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

    console.log('Responding to friend request:', responseData);
    console.log('API URL:', `${environment.apiUrl}friends/friend-request-response`);

    this.http.put(`${environment.apiUrl}friends/friend-request-response`, responseData, { headers: this.getHeaders() })
      .subscribe({
        next: (response) => {
          console.log('Friend request response successful:', response);
          this.loadFriendRequests();
          this.loadFriends();
          
          // If user accepted the friend request, switch to friends tab
          if (accepted) {
            this.setActiveTab('friends');
          }
        },
        error: (err) => {
          console.error('Failed to respond to friend request:', err);
          console.error('Request data was:', responseData);
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

    console.log('Removing friend:', friendUsername);
    this.http.delete(`${environment.apiUrl}friends/${encodeURIComponent(friendUsername)}`, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          console.log('Friend removed successfully');
          this.loadFriends();
        },
        error: (err) => {
          console.error('Failed to remove friend:', err);
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

    console.log('Inviting friend to game:', friendName);
    
    // First create a room
    this.http.post<any>(`${environment.apiUrl}rooms/create`, {}, { headers: this.getHeaders() })
      .subscribe({
        next: (roomResponse) => {
          console.log('Room created:', roomResponse);
          
          // Store that we're the host
          localStorage.setItem(`room_${roomResponse.id}_isHost`, 'true');
          
          // Now send invite to the friend
          const inviteRequest = {
            friendUserName: friendName
          };
          
          this.http.post(`${environment.apiUrl}rooms/invite`, inviteRequest, { headers: this.getHeaders() })
            .subscribe({
              next: (inviteResponse) => {
                console.log('Invite sent:', inviteResponse);
                this.showNotification(`Game invite sent to ${friendName}!`);
                
                // Navigate to the room
                window.location.href = `/room/${roomResponse.id}`;
              },
              error: (err) => {
                console.error('Failed to send invite:', err);
                this.error = `Failed to send invite: ${err.error?.message || err.statusText}`;
              }
            });
        },
        error: (err) => {
          console.error('Failed to create room:', err);
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
