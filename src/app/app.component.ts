import { Component, OnInit } from '@angular/core';
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
  title = 'Flag Finder';
  pendingInvite: { initiatorUserName: string; targetUserName: string; gameId: string } | null = null;

  constructor(private wsService: WebSocketService, private http: HttpClient) {
    this.wsService.invites$.subscribe((invite) => {
      if (invite?.initiatorUserName) {
        this.pendingInvite = invite;
      }
    });
  }

  ngOnInit(): void {
    this.wsService.connect();
  }

  acceptInvite(): void {
    if (!this.pendingInvite) return;
    const roomId = this.pendingInvite.gameId;
    const headers = new HttpHeaders().set('Content-Type', 'application/json').set('Accept', '*/*');
    this.http.post(`${environment.apiUrl}rooms/join`, { roomId }, { headers }).subscribe({
      next: () => {
        this.pendingInvite = null;
        window.location.href = `/room/${roomId}`;
      },
      error: () => {
        this.pendingInvite = null;
      }
    });
  }

  declineInvite(): void {
    this.pendingInvite = null;
  }
}
