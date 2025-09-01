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
  private roomUpdateHandlers = new Map<string, ((payload: any) => void)[]>();

  public invites$ = new ReplaySubject<{ initiatorUserName: string; targetUserName: string; gameId: string }>(1);
  public roomUpdates$ = new ReplaySubject<any>(1);
  public roomClosed$ = new ReplaySubject<{ roomId: string; message: string }>(1);
  public gameStarted$ = new ReplaySubject<any>(1);
  public roundStarted$ = new ReplaySubject<any>(1);
  public gameEnded$ = new ReplaySubject<any>(1);

  constructor(private cookieService: CookieService) {}

  connect(): void {
    if (this.client?.connected) return;
    const token = this.cookieService.getCookie('access_token');
    if (!token) return;

    const wsBase = environment.apiUrl.replace('/api/v1/', '').replace('http', 'ws');
    this.client = new Client({
      brokerURL: `${wsBase}/ws-native?token=${encodeURIComponent(token)}`,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
    });

    this.client.onConnect = () => {
      console.log('[WS] Connected to broker');
      console.log('[WS] Subscribing to WebSocket channels...');
      this.inviteSub = this.client!.subscribe('/user/queue/invites', (msg: IMessage) => {
        // console.log('[WS] Invite message received:', msg.body);
        try { this.invites$.next(JSON.parse(msg.body)); } catch (e) { console.warn('[WS] Failed to parse invite payload', e); }
      });

      this.roomUpdatesSub = this.client!.subscribe('/user/queue/room-updates', (msg: IMessage) => {
        // console.log('[WS] Room update received:', msg.body);
        try {
          const payload = JSON.parse(msg.body);
          this.roomUpdates$.next(payload);
          // Also dispatch a DOM event so components can listen without DI coupling
          window.dispatchEvent(new CustomEvent('room-updated', { detail: payload }));
          const handlers = this.roomUpdateHandlers.get(payload?.id);
          if (handlers && handlers.length) {
            handlers.forEach(h => {
              try { h(payload); } catch (e) { console.warn('[WS] Room update handler threw', e); }
            });
          }
          try {
            const anyWin: any = window as any;
            if (typeof anyWin.ffOnRoomUpdate === 'function') {
              anyWin.ffOnRoomUpdate(payload);
            }
          } catch (e) {
            console.warn('[WS] ffOnRoomUpdate callback failed', e);
          }
        } catch (e) {
          console.warn('[WS] Failed to parse room update payload', e);
        }
      });

      this.roomClosedSub = this.client!.subscribe('/user/queue/room-closed', (msg: IMessage) => {
        // console.log('[WS] Room closed received:', msg.body);
        try {
          const payload = JSON.parse(msg.body);
          this.roomClosed$.next(payload);
        } catch (e) {
          console.warn('[WS] Failed to parse room closed payload', e);
        }
        window.dispatchEvent(new CustomEvent('room-closed', { detail: msg.body }));
      });

      this.gameStartedSub = this.client!.subscribe('/user/queue/game-started', (msg: IMessage) => {
        console.log('[WS] 🎮 Game started received:', msg.body);
        try {
          const payload = JSON.parse(msg.body);
          console.log('[WS] 🎮 Game started payload parsed:', payload);
          console.log('[WS] 🎮 Current subscribers to gameStarted$:', this.gameStarted$.observers.length);
          this.gameStarted$.next(payload);
          window.dispatchEvent(new CustomEvent('game-started', { detail: payload }));
          console.log('[WS] 🎮 Game started event dispatched to', this.gameStarted$.observers.length, 'subscribers');
        } catch (e) {
          console.warn('[WS] Failed to parse game started payload', e);
        }
      });

      this.roundStartedSub = this.client!.subscribe('/user/queue/round-started', (msg: IMessage) => {
        console.log('[WS] 🔄 Round started received:', msg.body);
        try {
          const payload = JSON.parse(msg.body);
          console.log('[WS] 🔄 Round started payload parsed:', payload);
          this.roundStarted$.next(payload);
          window.dispatchEvent(new CustomEvent('round-started', { detail: payload }));
          console.log('[WS] 🔄 Round started event dispatched');
        } catch (e) {
          console.warn('[WS] Failed to parse round started payload', e);
        }
      });

      this.gameEndedSub = this.client!.subscribe('/user/queue/game-ended', (msg: IMessage) => {
        console.log('[WS] 🏁 Game ended received:', msg.body);
        try {
          const payload = JSON.parse(msg.body);
          console.log('[WS] 🏁 Game ended payload parsed:', payload);
          this.gameEnded$.next(payload);
          window.dispatchEvent(new CustomEvent('game-ended', { detail: payload }));
          console.log('[WS] 🏁 Game ended event dispatched');
        } catch (e) {
          console.warn('[WS] Failed to parse game ended payload', e);
        }
      });
      
      console.log('[WS] All subscriptions established');
    };

    this.client.onStompError = (frame) => {
      console.error('[WS] STOMP error', frame.headers['message'], frame.body);
    };

    this.client.onWebSocketClose = (evt) => {
      console.warn('[WS] Socket closed', evt);
    };

    this.client.onWebSocketError = (evt) => {
      console.error('[WS] Socket error', evt);
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


