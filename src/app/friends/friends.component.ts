import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.scss']
})
export class FriendsComponent implements OnInit {
  friends: any[] = [];
  friendRequests: any[] = [];
  sentRequests: any[] = [];
  newFriendUsername = '';
  requestMessage = '';
  isLoading = false;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadFriends();
    this.loadFriendRequests();
    this.loadSentRequests();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');
  }

  loadFriends(): void {
    this.http.get(`${environment.apiUrl}friends`, { headers: this.getHeaders() })
      .subscribe({
        next: (data: any) => {
          this.friends = data || [];
        },
        error: (err) => {
          this.error = 'Failed to load friends';
        }
      });
  }

  loadFriendRequests(): void {
    this.http.get(`${environment.apiUrl}friends/requests/received`, { headers: this.getHeaders() })
      .subscribe({
        next: (data: any) => {
          this.friendRequests = data || [];
        },
        error: (err) => {
          this.error = 'Failed to load friend requests';
        }
      });
  }

  loadSentRequests(): void {
    this.http.get(`${environment.apiUrl}friends/requests/sent`, { headers: this.getHeaders() })
      .subscribe({
        next: (data: any) => {
          this.sentRequests = data || [];
        },
        error: (err) => {
          this.error = 'Failed to load sent requests';
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
      targetUsername: this.newFriendUsername.trim(),
      message: this.requestMessage.trim() || undefined
    };

    this.http.post(`${environment.apiUrl}friends/request`, requestData, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.newFriendUsername = '';
          this.requestMessage = '';
          this.isLoading = false;
          this.loadSentRequests();
        },
        error: (err) => {
          this.isLoading = false;
          this.error = err.error?.message || 'Failed to send friend request';
        }
      });
  }

  respondToRequest(senderUsername: string, accepted: boolean): void {
    const responseData = {
      senderUsername,
      accepted
    };

    this.http.post(`${environment.apiUrl}friends/respond`, responseData, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.loadFriendRequests();
          this.loadFriends();
        },
        error: (err) => {
          this.error = 'Failed to respond to friend request';
        }
      });
  }

  removeFriend(friendUsername: string): void {
    if (!confirm(`Are you sure you want to remove ${friendUsername} from your friends?`)) {
      return;
    }

    this.http.delete(`${environment.apiUrl}friends/${friendUsername}`, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.loadFriends();
        },
        error: (err) => {
          this.error = 'Failed to remove friend';
        }
      });
  }

  clearError(): void {
    this.error = '';
  }
}
