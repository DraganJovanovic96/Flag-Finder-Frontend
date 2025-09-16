import { Injectable } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { environment } from '../../environments/environment';
import { CookieService } from './auth/cookie.service';
import { ReplaySubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client: Client | null = null;
  private inviteSub: StompSubscription | null = null;
  private roomUpdatesSub: StompSubscription | null = null;
  private roomClosedSub: StompSubscription | null = null;
  private gameStartedSub: StompSubscription | null = null;
  private roundStartedSub: StompSubscription | null = null;
  private gameEndedSub: StompSubscription | null = null;
  private friendRequestSub: StompSubscription | null = null;
  private friendResponseSub: StompSubscription | null = null;
  private friendRemovedSub: StompSubscription | null = null;
  private roomUpdateHandlers = new Map<string, ((payload: any) => void)[]>();

  public invites$ = new ReplaySubject<{ initiatorUserName: string; targetUserName: string; gameId: string }>(1);
  public roomUpdates$ = new ReplaySubject<any>(1);
  public roomClosed$ = new ReplaySubject<{ roomId: string; message: string }>(1);
  public gameStarted$ = new ReplaySubject<any>(1);
  public roundStarted$ = new ReplaySubject<any>(1);
  public gameEnded$ = new ReplaySubject<any>(1);
  public friendRequest$ = new ReplaySubject<any>(1);
  public friendResponse$ = new ReplaySubject<any>(1);
  public friendRemoved$ = new ReplaySubject<any>(1);

  constructor(private cookieService: CookieService) {}

  connect(): void {
    if (this.client?.connected) return;
    const token = this.cookieService.getCookie('access_token');
    if (!token) {
      return;
    }

    const wsBase = environment.apiUrl.replace('/api/v1/', '').replace('http://', 'ws://').replace('https://', 'wss://');
    this.client = new Client({
      brokerURL: `${wsBase}/ws-native?token=${encodeURIComponent(token)}`,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
    });

    this.client.onConnect = () => {
      this.inviteSub = this.client!.subscribe('/user/queue/invites', (msg: IMessage) => {
        try { this.invites$.next(JSON.parse(msg.body)); } catch (e) { }
      });

      this.roomUpdatesSub = this.client!.subscribe('/user/queue/room-updates', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          this.roomUpdates$.next(payload);
          window.dispatchEvent(new CustomEvent('room-updated', { detail: payload }));
          const handlers = this.roomUpdateHandlers.get(payload?.id);
          if (handlers && handlers.length) {
            handlers.forEach(h => {
              try { h(payload); } catch (e) { }
            });
          }
          try {
            const anyWin: any = window as any;
            if (typeof anyWin.ffOnRoomUpdate === 'function') {
              anyWin.ffOnRoomUpdate(payload);
            }
          } catch (e) {
          }
        } catch (e) {
        }
      });

      this.roomClosedSub = this.client!.subscribe('/user/queue/room-closed', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          this.roomClosed$.next(payload);
        } catch (e) {
        }
        window.dispatchEvent(new CustomEvent('room-closed', { detail: msg.body }));
      });

      this.gameStartedSub = this.client!.subscribe('/user/queue/game-started', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          this.gameStarted$.next(payload);
          window.dispatchEvent(new CustomEvent('game-started', { detail: payload }));
        } catch (e) {
        }
      });

      this.roundStartedSub = this.client!.subscribe('/user/queue/round-started', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          this.roundStarted$.next(payload);
          window.dispatchEvent(new CustomEvent('round-started', { detail: payload }));
        } catch (e) {
        }
      });

      this.gameEndedSub = this.client!.subscribe('/user/queue/game-ended', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          this.gameEnded$.next(payload);
          window.dispatchEvent(new CustomEvent('game-ended', { detail: payload }));
        } catch (e) {
        }
      });

      this.friendRequestSub = this.client!.subscribe('/user/queue/friend-request', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          this.friendRequest$.next(payload);
          window.dispatchEvent(new CustomEvent('friend-request', { detail: payload }));
        } catch (e) {
        }
      });

      this.friendResponseSub = this.client!.subscribe('/user/queue/friend-response', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          this.friendResponse$.next(payload);
          window.dispatchEvent(new CustomEvent('friend-response', { detail: payload }));
        } catch (e) {
        }
      });

      this.friendRemovedSub = this.client!.subscribe('/user/queue/friend-removed', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          this.friendRemoved$.next(payload);
          window.dispatchEvent(new CustomEvent('friend-removed', { detail: payload }));
        } catch (e) {
        }
      });
      
    };

    this.client.onStompError = (frame) => {
    };

    this.client.onWebSocketClose = (evt) => {
    };

    this.client.onWebSocketError = (evt) => {
    };

    this.client.activate();
  }

  disconnect(): void {
    this.inviteSub?.unsubscribe();
    this.roomUpdatesSub?.unsubscribe();
    this.roomClosedSub?.unsubscribe();
    this.gameStartedSub?.unsubscribe();
    this.roundStartedSub?.unsubscribe();
    this.gameEndedSub?.unsubscribe();
    this.friendRequestSub?.unsubscribe();
    this.friendResponseSub?.unsubscribe();
    this.friendRemovedSub?.unsubscribe();
    this.client?.deactivate();
    this.client = null;
  }

  registerRoomUpdateHandler(roomId: string, handler: (payload: any) => void): void {
    const arr = this.roomUpdateHandlers.get(roomId) || [];
    arr.push(handler);
    this.roomUpdateHandlers.set(roomId, arr);
  }

  unregisterRoomUpdateHandler(roomId: string, handler: (payload: any) => void): void {
    const arr = this.roomUpdateHandlers.get(roomId) || [];
    const next = arr.filter(h => h !== handler);
    if (next.length) {
      this.roomUpdateHandlers.set(roomId, next);
    } else {
      this.roomUpdateHandlers.delete(roomId);
    }
  }
}


