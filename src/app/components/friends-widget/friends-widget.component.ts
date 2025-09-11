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
  newFriendUsername = '';
  requestMessage = '';
  isLoading = false;
  error = '';
  
  private friendRequestSub?: Subscription;
  private friendResponseSub?: Subscription;

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
  }

  private setupWebSocketListeners(): void {
    this.friendRequestSub = this.webSocketService.friendRequest$.subscribe((data) => {
      if (data) {
        this.loadFriendRequests();
        this.showNotification(`Friend request from ${data.senderUsername}`);
      }
    });

    this.friendResponseSub = this.webSocketService.friendResponse$.subscribe((data) => {
      if (data) {
        this.loadFriends();
        const message = data.accepted ? 
          `${data.username} accepted your friend request!` : 
          `${data.username} declined your friend request`;
        this.showNotification(message);
      }
    });
  }

  private showNotification(message: string): void {
    console.log('Friend notification:', message);
  }

  toggleWidget(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.authService.isAuthenticated()) {
      this.loadFriends();
      this.loadFriendRequests();
      // Setup WebSocket listeners if not already done
      if (!this.friendRequestSub && !this.friendResponseSub) {
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
          this.friends = data || [];
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
          this.requestMessage = '';
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
        },
        error: (err) => {
          console.error('Failed to respond to friend request:', err);
          console.error('Request data was:', responseData);
          this.error = `Failed to respond to friend request: ${err.status} - ${err.error?.message || err.statusText}`;
        }
      });
  }

  removeFriend(friendUsername: string): void {
    if (!confirm(`Remove ${friendUsername} from friends?`)) {
      return;
    }

    // Remove friend functionality not implemented in backend yet
    this.error = 'Remove friend feature not yet implemented';
  }

  clearError(): void {
    this.error = '';
  }
}
