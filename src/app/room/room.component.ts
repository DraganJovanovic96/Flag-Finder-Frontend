import { Component, OnInit, Input, OnDestroy, NgZone, ChangeDetectorRef, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth/auth.service';
import { WebSocketService } from '../services/websocket.service';
import { UserService, UserInfo } from '../services/user.service';
import { Subscription } from 'rxjs';

const BASIC_URL = environment.apiUrl;

interface Room {
  id: string;
  hostUserName: string;
  guestUserName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
  gameStartedAt: string | null;
  gameEndedAt: string | null;
}

@Component({
  selector: 'app-room',
  standalone: true,
  templateUrl: 'room.component.html',
  styleUrls: ['./room.component.scss'],
  imports: [CommonModule, FormsModule],
})
export class RoomComponent implements OnInit, OnDestroy {
  @Input() roomData: Room | null = null;
  @ViewChild('friendGameNameInput') friendGameNameInput!: ElementRef<HTMLInputElement>;
  
  room: Room | null = null;
  roomId = '';
  isLoading = false;
  errorMessage: string | null = null;
  currentUsername = '';
  isHost = false;

  // Friend invitation properties
  showInviteForm = false;
  friendGameName = '';
  isInviting = false;
  inviteMessage = '';
  private subscriptions: Subscription[] = [];

  // User info properties
  hostUserInfo: UserInfo | null = null;
  guestUserInfo: UserInfo | null = null;
  loadingUserInfo = false;

  // Continent selection properties
  availableContinents = [
    { value: 'ASIA', label: 'Asia', selected: false },
    { value: 'AFRICA', label: 'Africa', selected: false },
    { value: 'NORTH_AMERICA', label: 'North America', selected: false },
    { value: 'SOUTH_AMERICA', label: 'South America', selected: false },
    { value: 'EUROPE', label: 'Europe', selected: false },
    { value: 'AUSTRALIA', label: 'Australia & Oceania', selected: false }
  ];
  showContinentSelection = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private wsService: WebSocketService,
    private userService: UserService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    (window as any).ffOnRoomUpdate = (payload: any) => {
      if (payload && this.roomId && payload.id === this.roomId) {
        // console.log('[RoomComponent] ffOnRoomUpdate applied');
        this.ngZone.run(() => {
          this.room = payload as Room;
          this.cdr.detectChanges();
          this.loadRoom();
          this.loadUserInfo();
        });
      }
    };
  }

  ngOnInit(): void {
    console.log('[RoomComponent] ngOnInit called');
    
    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    // Initialize continent selection - select all by default
    this.selectAllContinents();

    // Ensure WebSocket connection is established
    console.log('[RoomComponent] Establishing WebSocket connection...');
    this.wsService.connect();
    
    // Subscribe to game started notifications FIRST - before any async operations
    console.log('[RoomComponent] Setting up game-started subscription immediately');
    this.subscriptions.push(
      this.wsService.gameStarted$.subscribe({
        next: (gameData: any) => {
          console.log('[RoomComponent] ✅ Game started notification received:', gameData);
          console.log('[RoomComponent] Current roomId:', this.roomId);
          console.log('[RoomComponent] Game data roomId:', gameData?.roomId);
          
          // Only navigate if the game notification is for THIS room
          if (gameData?.roomId === this.roomId) {
            this.ngZone.run(() => {
              console.log('[RoomComponent] 🚀 Navigating to game for current room:', this.roomId);
              this.router.navigate(['/game', this.roomId]);
            });
          } else {
            console.log('[RoomComponent] ⚠️ Ignoring game notification for different room:', gameData?.roomId);
          }
        },
        error: (error) => {
          console.error('[RoomComponent] ❌ Error in game-started subscription:', error);
        },
        complete: () => {
          console.log('[RoomComponent] Game-started subscription completed');
        }
      })
    );
    
    // Add a small delay to ensure WebSocket subscriptions are ready
    setTimeout(() => {
      console.log('[RoomComponent] WebSocket subscriptions should be ready');
    }, 1000);

    // If room data is provided as input, use it directly
    if (this.roomData) {
      this.room = this.roomData;
      this.roomId = this.roomData.id;
      this.setupRoom();
      return;
    }

    // Get room ID from route parameters and check if user is host
    this.route.params.subscribe(params => {
      this.roomId = params['id'];
      // console.log('[RoomComponent] Route param roomId set to:', this.roomId);
      if (this.roomId) {
        // Check if user is host from localStorage
        this.isHost = localStorage.getItem(`room_${this.roomId}_isHost`) === 'true';
        this.loadRoom();
        // Register room-specific WS handler AFTER roomId is known
        const handler = (roomUpdate: any) => {
          // console.log('[RoomComponent] direct handler received for', this.roomId, roomUpdate);
          if (roomUpdate && roomUpdate.id && roomUpdate.id === this.roomId) {
            this.ngZone.run(() => {
              this.room = roomUpdate as Room;
              this.cdr.detectChanges();
              this.loadRoom();
              this.loadUserInfo();
            });
          }
        };
        this.wsService.registerRoomUpdateHandler(this.roomId, handler);
        this.subscriptions.push({ unsubscribe: () => this.wsService.unregisterRoomUpdateHandler(this.roomId, handler) } as any);
      }
    });

    // Fallback listener via DOM event in case DI stream misses
    const domListener = (e: any) => {
      const detail = e.detail;
      // console.log('[RoomComponent] window event room-updated:', detail);
      if (detail && detail.id === this.roomId) {
        this.ngZone.run(() => {
          this.room = detail as Room;
          this.cdr.detectChanges();
          this.loadRoom();
          this.loadUserInfo();
        });
      }
    };
    window.addEventListener('room-updated', domListener as EventListener);
    // Store cleanup manually since it's not an RxJS subscription
    (this as any)._domListener = domListener;

    // Listen for room-closed notifications
    const closedListener = (e: any) => {
      // console.log('[RoomComponent] window event room-closed:', e.detail);
      // If host, kick guest already handled via update; if guest, navigate out
      this.ngZone.run(() => {
        this.router.navigate(['/create-room']);
      });
    };
    window.addEventListener('room-closed', closedListener as EventListener);
    (this as any)._closedListener = closedListener;

    // Subscribe to room updates from WebSocket service
    this.subscriptions.push(
      this.wsService.roomUpdates$.subscribe((roomUpdate: any) => {
        // console.log('[RoomComponent] Room update received from WS service:', roomUpdate);
        if (roomUpdate && roomUpdate.id === this.roomId) {
          this.ngZone.run(() => {
            // console.log('[RoomComponent] Updating room with WS data:', roomUpdate);
            this.room = roomUpdate as Room;
            this.cdr.detectChanges();
            this.loadUserInfo();
            // Don't call loadRoom() here to avoid overwriting WS data with HTTP response
          });
        }
      })
    );

    // Game started subscription is now set up at the top of ngOnInit

    // Fallback DOM event listener for game-started
    const gameStartedListener = (e: any) => {
      console.log('[RoomComponent] DOM event game-started:', e.detail);
      this.ngZone.run(() => {
        this.router.navigate(['/game', this.roomId]);
      });
    };
    window.addEventListener('game-started', gameStartedListener);
    
    // Store reference for cleanup
    (this as any).gameStartedListener = gameStartedListener;

    // Subscribe to room closed notifications from WebSocket service
    this.subscriptions.push(
      this.wsService.roomClosed$.subscribe((roomClosed: any) => {
        this.ngZone.run(() => {
          // console.log('[RoomComponent] Room closed received from WS service:', roomClosed);
          if (roomClosed && roomClosed.roomId === this.roomId) {
            this.errorMessage = roomClosed.message || 'The room has been closed by the host.';
            setTimeout(() => {
              this.router.navigate(['/create-room']);
            }, 3000);
          }
        });
      })
    );
  }

  setupRoom(): void {
    // Room setup is handled by the calling context (localStorage vs route params)
  }

  loadRoom(): void {
    this.isLoading = true;
    this.errorMessage = null;

    // Get current user info from auth service
    this.currentUsername = this.authService.getCurrentUserGameName();
    console.log('LoadRoom - Current username set to:', this.currentUsername);

    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    // Auth interceptor will add the Authorization header
    this.http.get<Room>(`${BASIC_URL}rooms/${this.roomId}`, { headers })
      .subscribe({
        next: (response) => {
          // console.log('Room loaded:', response);
          // Avoid overwriting newer WS-updated state with stale HTTP response
          if (
            this.room && this.room.id === response.id &&
            this.room.guestUserName && !response.guestUserName
          ) {
            // console.log('Ignoring stale room HTTP response in favor of WS-updated state');
          } else {
            this.room = response;
            // Host status is already set from query params if user created room
            // No need to check with backend - creator is automatically host
            this.setupRoom();
            this.loadUserInfo();
          }
          this.isLoading = false;
        },
        error: (error) => {
          // console.error('Error loading room:', error);
          this.isLoading = false;
          
          if (error.status === 404) {
            this.errorMessage = 'Room not found.';
          } else if (error.status === 401) {
            this.errorMessage = 'Session expired. Please login again.';
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 2000);
          } else {
            this.errorMessage = 'Failed to load room. Please try again.';
          }
        }
      });
  }

  inviteFriend(): void {
    if (!this.friendGameName.trim()) {
      this.inviteMessage = 'Please enter a friend\'s game name';
      return;
    }

    if (!this.room) {
      this.inviteMessage = 'You must be in a room to invite friends';
      return;
    }

    this.isInviting = true;
    this.inviteMessage = '';

    // Send invitation via REST API
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    const inviteRequest = {
      friendUserName: this.friendGameName.trim()
    };

    this.http.post(`${BASIC_URL}rooms/invite`, inviteRequest, { headers })
      .subscribe({
        next: (response: any) => {
          // console.log('Friend invitation sent:', response);
          this.inviteMessage = `Invitation sent to ${this.friendGameName}!`;
          this.friendGameName = '';
          this.showInviteForm = false;
          this.isInviting = false;

          // Clear message after 3 seconds
          setTimeout(() => {
            this.inviteMessage = '';
          }, 3000);
        },
        error: (error) => {
          // console.error('Error sending friend invitation:', error);
          this.inviteMessage = error.error?.message || 'Failed to send invitation. Please try again.';
          this.isInviting = false;
        }
      });
  }

  toggleInviteForm(): void {
    this.showInviteForm = !this.showInviteForm;
    if (!this.showInviteForm) {
      this.friendGameName = '';
      this.inviteMessage = '';
    } else {
      // Auto-focus and select text when form is shown
      setTimeout(() => {
        if (this.friendGameNameInput) {
          this.friendGameNameInput.nativeElement.focus();
          this.friendGameNameInput.nativeElement.select();
        }
      }, 0);
    }
  }

  startGame(): void {
    if (!this.room) {
      this.errorMessage = 'Room not found';
      return;
    }

    if (!this.room.guestUserName) {
      this.errorMessage = 'You need a guest player to start the game';
      return;
    }

    const selectedContinents = this.getSelectedContinents();
    if (selectedContinents.length === 0) {
      this.errorMessage = 'Please select at least one continent';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    // Call backend to start the game with selected continents
    const startGameRequest = { 
      roomId: this.room.id,
      continents: selectedContinents
    };
    
    this.http.post(`${BASIC_URL}games/start`, startGameRequest, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response: any) => {
        // console.log('Game started successfully:', response);
        this.inviteMessage = 'Game is starting...';
        
        // Navigate to game component after a short delay
        setTimeout(() => {
          this.router.navigate(['/game', this.room!.id]);
        }, 1500);
      },
      error: (error) => {
        // console.error('Error starting game:', error);
        this.errorMessage = error.error?.message || 'Failed to start game';
        this.isLoading = false;
      }
    });
  }

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');
  }

  leaveRoom(): void {
    const headers = this.getAuthHeaders();

    this.http.post(`${BASIC_URL}rooms/cancel`, {}, { headers })
      .subscribe({
        next: () => {
          // console.log('Left room successfully');
          this.router.navigate(['/create-room']);
        },
        error: (error) => {
          // console.error('Error leaving room:', error);
          this.errorMessage = 'Failed to leave room. Please try again.';
        }
      });
  }

  copyRoomId(): void {
    if (this.room) {
      navigator.clipboard.writeText(this.room.id).then(() => {
        // You could add a toast notification here
        // console.log('Room ID copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy room ID:', err);
      });
    }
  }

  getUserProfilePicture(username: string): string | null {
    // TODO: This should be replaced with actual user profile picture logic
    // For now, we'll return null to show the fallback icons
    // In a real app, this would fetch from user service or API
    
    // Example of how it could work:
    // return this.userService.getProfilePicture(username);
    
    // For demo purposes, you could uncomment this to test with placeholder images:
    // return `https://via.placeholder.com/60x60/667eea/ffffff?text=${username.charAt(0).toUpperCase()}`;
    
    return null;
  }

  goBack(): void {
    this.leaveRoom();
  }

  logout(): void {
    this.authService.logout();
  }

  isCurrentUserHost(): boolean {
    return this.isHost;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    if ((this as any)._domListener) {
      window.removeEventListener('room-updated', (this as any)._domListener as EventListener);
      (this as any)._domListener = null;
    }
    if ((this as any)._closedListener) {
      window.removeEventListener('room-closed', (this as any)._closedListener as EventListener);
      (this as any)._closedListener = null;
    }
    if ((this as any).gameStartedListener) {
      window.removeEventListener('game-started', (this as any).gameStartedListener);
      (this as any).gameStartedListener = null;
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    this.sendLeaveRoomBeacon();
  }

  private sendLeaveRoomBeacon(): void {
    const token = this.getTokenFromCookie();
    // console.log('[RoomComponent] sendLeaveRoomBeacon called, token found:', !!token);
    if (!token) return;

    const data = new FormData();
    data.append('token', token);

    // Use sendBeacon for reliable delivery during page unload
    if (navigator.sendBeacon) {
      // console.log('[RoomComponent] Sending beacon request to leave room');
      navigator.sendBeacon(`${BASIC_URL}rooms/cancel`, data);
    } else {
      // console.log('[RoomComponent] sendBeacon not supported');
    }
  }

  private getTokenFromCookie(): string | null {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'access_token') {
        return value;
      }
    }
    return null;
  }

  private loadUserInfo(): void {
    if (!this.room) {
      console.log('[UserInfo] No room available, skipping user info load');
      return;
    }

    console.log('[UserInfo] Loading user info for room:', this.room.id);
    console.log('[UserInfo] Host:', this.room.hostUserName, 'Guest:', this.room.guestUserName);
    this.loadingUserInfo = true;

    // Load host user info
    if (this.room.hostUserName) {
      console.log('[UserInfo] Fetching host user info for:', this.room.hostUserName);
      this.userService.getUserInfo(this.room.hostUserName).subscribe({
        next: (userInfo) => {
          console.log('[UserInfo] Host user info received:', userInfo);
          this.hostUserInfo = userInfo;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('[UserInfo] Error loading host user info:', error);
          console.error('[UserInfo] Error details:', error.error);
          this.hostUserInfo = { userName: this.room!.hostUserName };
        }
      });
    }

    // Load guest user info if guest exists
    if (this.room.guestUserName) {
      console.log('[UserInfo] Fetching guest user info for:', this.room.guestUserName);
      this.userService.getUserInfo(this.room.guestUserName).subscribe({
        next: (userInfo) => {
          console.log('[UserInfo] Guest user info received:', userInfo);
          this.guestUserInfo = userInfo;
          this.loadingUserInfo = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('[UserInfo] Error loading guest user info:', error);
          console.error('[UserInfo] Error details:', error.error);
          this.guestUserInfo = { userName: this.room!.guestUserName! };
          this.loadingUserInfo = false;
        }
      });
    } else {
      console.log('[UserInfo] No guest user, skipping guest info load');
      this.guestUserInfo = null;
      this.loadingUserInfo = false;
    }
  }

  getDisplayedGamesWon(userInfo: UserInfo | null): string {
    const result = userInfo?.numberOfWonGame !== undefined ? userInfo.numberOfWonGame.toString() : '0';
    console.log('[UserInfo] getDisplayedGamesWon for', userInfo?.userName, ':', result, 'raw value:', userInfo?.numberOfWonGame);
    return result;
  }

  getDisplayedAccuracy(userInfo: UserInfo | null): string {
    const result = userInfo?.accuracyPercentage !== undefined ? `${userInfo.accuracyPercentage}%` : '0%';
    console.log('[UserInfo] getDisplayedAccuracy for', userInfo?.userName, ':', result, 'raw value:', userInfo?.accuracyPercentage);
    return result;
  }

  // Continent selection methods
  onContinentChange(): void {
    // This method is called when continent checkboxes change
    // We can add validation or other logic here if needed
  }

  toggleContinentSelection(): void {
    this.showContinentSelection = !this.showContinentSelection;
  }

  canEditContinents(): boolean {
    return this.isHost;
  }

  selectAllContinents(): void {
    this.availableContinents.forEach(continent => {
      continent.selected = true;
    });
  }

  clearAllContinents(): void {
    this.availableContinents.forEach(continent => {
      continent.selected = false;
    });
  }

  getSelectedContinents(): string[] {
    return this.availableContinents
      .filter(continent => continent.selected)
      .map(continent => continent.value);
  }

  getSelectedContinentsText(): string {
    const selected = this.availableContinents
      .filter(continent => continent.selected)
      .map(continent => continent.label);
    return selected.join(', ');
  }
}
