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
  numberOfRounds: number;
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

  showInviteForm = false;
  friendGameName = '';
  isInviting = false;
  inviteMessage = '';
  private subscriptions: Subscription[] = [];

  hostUserInfo: UserInfo | null = null;
  guestUserInfo: UserInfo | null = null;
  loadingUserInfo = false;

  // Round selection properties
  selectedRounds = 5;
  roundOptions = [
    { value: 3, label: '3 Rounds' },
    { value: 5, label: '5 Rounds' },
    { value: 10, label: '10 Rounds' },
    { value: 15, label: '15 Rounds' },
    { value: 20, label: '20 Rounds' }
  ];

  availableContinents = [
    { value: 'ASIA', label: 'Asia', selected: false },
    { value: 'AFRICA', label: 'Africa', selected: false },
    { value: 'NORTH_AMERICA', label: 'North America', selected: false },
    { value: 'SOUTH_AMERICA', label: 'South America', selected: false },
    { value: 'EUROPE', label: 'Europe', selected: false },
    { value: 'AUSTRALIA', label: 'Australia & Oceania', selected: false },
    { value: 'USA_STATE', label: 'USA States', selected: false }
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
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.selectAllContinents();

    this.wsService.connect();
    
    this.subscriptions.push(
      this.wsService.gameStarted$.subscribe({
        next: (gameData: any) => {
          if (gameData?.roomId === this.roomId) {
            this.ngZone.run(() => {
              this.router.navigate(['/game', this.roomId]);
            });
          } else {
          }
        },
        error: (error) => {
        },
        complete: () => {
        }
      })
    );
    
    setTimeout(() => {
    }, 1000);

    if (this.roomData) {
      this.room = this.roomData;
      this.roomId = this.roomData.id;
      this.setupRoom();
      return;
    }

    this.route.params.subscribe(params => {
      this.roomId = params['id'];
      if (this.roomId) {
        this.isHost = localStorage.getItem(`room_${this.roomId}_isHost`) === 'true';
        this.loadRoom();
        const handler = (roomUpdate: any) => {
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

    const domListener = (e: any) => {
      const detail = e.detail;
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
    (this as any)._domListener = domListener;

    const closedListener = (e: any) => {
      this.ngZone.run(() => {
        this.router.navigate(['/home']);
      });
    };
    window.addEventListener('room-closed', closedListener as EventListener);
    (this as any)._closedListener = closedListener;

    this.subscriptions.push(
      this.wsService.roomUpdates$.subscribe((roomUpdate: any) => {
        if (roomUpdate && roomUpdate.id === this.roomId) {
          this.ngZone.run(() => {
            this.room = roomUpdate as Room;
            this.cdr.detectChanges();
            this.loadUserInfo();
          });
        }
      })
    );

    const gameStartedListener = (e: any) => {
      this.ngZone.run(() => {
        this.router.navigate(['/game', this.roomId]);
      });
    };
    window.addEventListener('game-started', gameStartedListener);
    
    (this as any).gameStartedListener = gameStartedListener;

    this.subscriptions.push(
      this.wsService.roomClosed$.subscribe((roomClosed: any) => {
        this.ngZone.run(() => {
          if (roomClosed && roomClosed.roomId === this.roomId) {
            this.errorMessage = roomClosed.message || 'The room has been closed by the host.';
            setTimeout(() => {
              this.router.navigate(['/home']);
            }, 3000);
          }
        });
      })
    );
  }

  setupRoom(): void {
    if (this.room) {
      // Initialize selectedRounds from room data
      this.selectedRounds = this.room.numberOfRounds || 5;
      
      // Set host status
      this.isHost = this.room.hostUserName === this.currentUsername;
    }
  }

  loadRoom(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.currentUsername = this.authService.getCurrentUserGameName();

    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    this.http.get<Room>(`${BASIC_URL}rooms/${this.roomId}`, { headers })
      .subscribe({
        next: (response) => {
          this.room = response;
          this.setupRoom();
          this.loadUserInfo();
          this.isLoading = false;
        },
        error: (error) => {
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

    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    const inviteRequest = {
      friendUserName: this.friendGameName.trim()
    };

    this.http.post(`${BASIC_URL}rooms/invite`, inviteRequest, { headers })
      .subscribe({
        next: (response: any) => {
          this.inviteMessage = `Invitation sent to ${this.friendGameName}!`;
          this.friendGameName = '';
          this.showInviteForm = false;
          this.isInviting = false;

          setTimeout(() => {
            this.inviteMessage = '';
          }, 3000);
        },
        error: (error) => {
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

    const startGameRequest = { 
      roomId: this.room.id,
      continents: selectedContinents
    };
    
    this.http.post(`${BASIC_URL}games/start`, startGameRequest, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response: any) => {
        this.inviteMessage = 'Game is starting...';
        
        setTimeout(() => {
          this.router.navigate(['/game', this.room!.id]);
        }, 1500);
      },
      error: (error) => {
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
          localStorage.removeItem(`room_${this.roomId}_isHost`);
          this.router.navigate(['/home']);
        },
        error: (error) => {
          this.errorMessage = 'Failed to leave room. Please try again.';
          setTimeout(() => {
            localStorage.removeItem(`room_${this.roomId}_isHost`);
            this.router.navigate(['/home']);
          }, 2000);
        }
      });
  }

  copyRoomId(): void {
    if (this.room) {
      navigator.clipboard.writeText(this.room.id).then(() => {
      }).catch(err => {
      });
    }
  }

  getUserProfilePicture(username: string): string | null {
    
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
    if (!token) return;

    const data = new FormData();
    data.append('token', token);

    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${BASIC_URL}rooms/cancel`, data);
    } else {
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
      return;
    }

    this.loadingUserInfo = true;

    if (this.room.hostUserName) {
      this.userService.getUserInfo(this.room.hostUserName).subscribe({
        next: (userInfo) => {
          this.hostUserInfo = userInfo;
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.hostUserInfo = { userName: this.room!.hostUserName };
        }
      });
    }

    if (this.room.guestUserName) {
      this.userService.getUserInfo(this.room.guestUserName).subscribe({
        next: (userInfo) => {
          this.guestUserInfo = userInfo;
          this.loadingUserInfo = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.guestUserInfo = { userName: this.room!.guestUserName! };
          this.loadingUserInfo = false;
        }
      });
    } else {
      this.guestUserInfo = null;
      this.loadingUserInfo = false;
    }
  }

  getDisplayedGamesWon(userInfo: UserInfo | null): string {
    const result = userInfo?.numberOfWonGame !== undefined ? userInfo.numberOfWonGame.toString() : '0';
    return result;
  }

  getDisplayedAccuracy(userInfo: UserInfo | null): string {
    const result = userInfo?.accuracyPercentage !== undefined ? `${userInfo.accuracyPercentage}%` : '0%';
    return result;
  }

  getDisplayedBestStreak(userInfo: UserInfo | null): string {
    const result = userInfo?.bestStreak !== undefined ? userInfo.bestStreak.toString() : '0';
    return result;
  }

  onContinentChange(): void {
  }

  onRoundsChange(): void {
    if (!this.room) return;
    
    // Update the room's numberOfRounds via API
    const updateRequest = {
      numberOfRounds: this.selectedRounds
    };
    
    this.http.put(`${BASIC_URL}rooms/${this.room.id}/rounds`, updateRequest, { 
      headers: this.getAuthHeaders() 
    }).subscribe({
      next: (response: any) => {
        if (this.room) {
          this.room.numberOfRounds = this.selectedRounds;
        }
      },
      error: (error) => {
        console.error('Failed to update rounds:', error);
        // Revert selection on error
        this.selectedRounds = this.room?.numberOfRounds || 5;
      }
    });
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
