import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Subscription, interval } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';
import { WebSocketService } from '../services/websocket.service';

const BASIC_URL = environment.apiUrl;

interface Game {
  id: string;
  hostName: string;
  guestName: string;
  hostScore: number;
  guestScore: number;
  totalRounds: number;
  currentRound: number;
  status: string;
  currentRoundData: {
    id: string;
    roundNumber: number;
    countryName: string;
    countryId: string;
    flagImage: number[];
    timeRemaining: number;
    roundActive: boolean;
  };
}

@Component({
  selector: 'app-game',
  standalone: true,
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  imports: [CommonModule, FormsModule],
})
export class GameComponent implements OnInit, OnDestroy {
  roomId: string = '';
  game: Game | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  
  // Game start countdown
  showStartCountdown = false;
  startCountdown = 5;
  
  // Round timer
  roundTimeRemaining = 0;
  private roundTimerInterval: any = null;
  
  // User input
  userGuess = '';
  guessMessage = '';
  isSubmittingGuess = false;
  isGuessCorrect: boolean | null = null;
  
  // Cache flag URL to prevent excessive calls
  private cachedFlagUrl: string = '';
  private lastCountryId: string = '';
  
  // Subscriptions
  private gameStateInterval: Subscription | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private authService: AuthService,
    private wsService: WebSocketService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    // Ensure WebSocket connection is established
    this.wsService.connect();
    
    // Subscribe to round started notifications
    this.subscriptions.push(
      this.wsService.roundStarted$.subscribe({
        next: (gameData: any) => {
          console.log('[GameComponent] Round started notification received:', gameData);
          this.ngZone.run(() => {
            if (gameData && this.game && gameData.id === this.game.id) {
              // Update game state immediately with new round data
              console.log('[GameComponent] WebSocket round start - updating from round', this.game.currentRound, 'to', gameData.currentRound);
              this.game = gameData;
              this.roundTimeRemaining = gameData.currentRoundData?.timeRemaining || 0;
              this.startRoundTimer();
              this.userGuess = '';
              this.guessMessage = '';
              this.cdr.detectChanges();
              console.log('[GameComponent] Game state updated for new round:', gameData.currentRound);
            }
          });
        },
        error: (error) => {
          console.error('[GameComponent] Error in round-started subscription:', error);
        }
      })
    );

    // Subscribe to game ended notifications
    this.subscriptions.push(
      this.wsService.gameEnded$.subscribe({
        next: (gameData: any) => {
          console.log('[GameComponent] Game ended notification received:', gameData);
          this.ngZone.run(() => {
            if (gameData && this.game && gameData.id === this.game.id) {
              // Update game state with final results
              this.game = gameData;
              this.handleGameEnd();
              this.cdr.detectChanges();
              console.log('[GameComponent] Game ended, showing results');
            }
          });
        },
        error: (error) => {
          console.error('[GameComponent] Error in game-ended subscription:', error);
        }
      })
    );

    this.route.params.subscribe(params => {
      this.roomId = params['roomId'];
      if (this.roomId) {
        this.initializeGame();
      }
    });
  }

  ngOnDestroy(): void {
    // Clear round timer
    if (this.roundTimerInterval) {
      clearInterval(this.roundTimerInterval);
      this.roundTimerInterval = null;
    }
    
    if (this.gameStateInterval) {
      this.gameStateInterval.unsubscribe();
    }
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  initializeGame(): void {
    this.isLoading = true;
    
    // First, try to get existing game for this room
    this.getExistingGame();
  }

  getExistingGame(): void {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    this.http.get<Game>(`${BASIC_URL}games/room/${this.roomId}`, { headers })
      .subscribe({
        next: (response: Game) => {
          console.log('Existing game found:', response);
          this.game = response;
          this.roundTimeRemaining = response.currentRoundData?.timeRemaining || 0;
          this.isLoading = false;
          this.startGameStatePolling();
          this.startRoundTimer();
        },
        error: (error) => {
          if (error.status === 404) {
            // No existing game, try to start a new one
            console.log('No existing game found, starting new game');
            this.startGame();
          } else {
            console.error('Error getting existing game:', error);
            this.errorMessage = error.error?.message || 'Failed to load game';
            this.isLoading = false;
          }
        }
      });
  }

  startGame(): void {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    const startGameRequest = {
      roomId: this.roomId
    };

    this.http.post<Game>(`${BASIC_URL}games/start`, startGameRequest, { headers })
      .subscribe((response: Game) => {
        console.log('Game started:', response);
        this.game = response;
        this.roundTimeRemaining = response.currentRoundData?.timeRemaining || 0;
        this.isLoading = false;
        this.startGameStatePolling();
        this.startRoundTimer();
      },
      error => {
        console.error('Error starting game:', error);
        this.errorMessage = error.error?.message || 'Failed to start game';
        this.isLoading = false;
      });
  }

  startGameStatePolling(): void {
    // Poll game state every 500ms for real-time updates
    this.gameStateInterval = interval(500).subscribe(() => {
      if (this.game) {
        this.fetchGameState();
      }
    });
  }

  fetchGameState(): void {
    if (!this.game) return;

    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    this.http.get<Game>(`${BASIC_URL}games/${this.game.id}`, { headers })
      .subscribe((response: Game) => {
        const oldRound = this.game?.currentRound;
        this.game = response;
        
        // If round changed, restart timer
        if (oldRound !== response.currentRound) {
          console.log('Round changed from', oldRound, 'to', response.currentRound);
          this.roundTimeRemaining = response.currentRoundData?.timeRemaining || 0;
          this.startRoundTimer();
          this.userGuess = '';
          this.guessMessage = '';
        }
        
        // Check if game ended
        if (response.status === 'COMPLETED') {
          console.log('Game completed detected via polling, calling handleGameEnd');
          this.handleGameEnd();
        }
      },
      error => {
        console.error('Error fetching game state:', error);
      });
  }

  startRoundTimer(): void {
    // Clear any existing timer first
    if (this.roundTimerInterval) {
      clearInterval(this.roundTimerInterval);
      this.roundTimerInterval = null;
    }
    
    if (!this.game?.currentRoundData?.roundActive) return;
    
    this.roundTimeRemaining = this.game.currentRoundData.timeRemaining;
    console.log('Starting round timer with', this.roundTimeRemaining, 'seconds for round', this.game.currentRound);
    
    this.roundTimerInterval = setInterval(() => {
      this.roundTimeRemaining--;
      
      if (this.roundTimeRemaining <= 0) {
        clearInterval(this.roundTimerInterval);
        this.roundTimerInterval = null;
      }
    }, 1000);
  }

  submitGuess(): void {
    if (!this.game || !this.userGuess.trim() || this.isSubmittingGuess) return;
    
    this.isSubmittingGuess = true;
    this.guessMessage = '';
    
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    const guessRequest = {
      gameId: this.game.id,
      roundNumber: this.game.currentRound,
      guessedCountryName: this.userGuess.trim()
    };

    this.http.post<any>(`${BASIC_URL}games/guess`, guessRequest, { headers })
      .subscribe((response: any) => {
        console.log('Guess submitted:', response);
        const prevGame = this.game;
        this.game = response.game;
        this.guessMessage = response.message;
        this.isSubmittingGuess = false;
        
        // Apply correct/incorrect styling and trigger score animation
        this.isGuessCorrect = response.correct;
        if (response.correct) {
          console.log('[Animation] Correct guess, scheduling trigger for +', response.pointsAwarded);
          // Give time for WS/poll-driven DOM re-render between rounds
          setTimeout(() => {
            if ('requestAnimationFrame' in window) {
              requestAnimationFrame(() => {
                // Determine which side scored based on score delta
                let isHost = true;
                if (prevGame) {
                  const hostIncreased = response.game.hostScore > prevGame.hostScore;
                  const guestIncreased = response.game.guestScore > prevGame.guestScore;
                  // Prefer explicit deltas; if both changed (edge), default to host
                  if (hostIncreased && !guestIncreased) {
                    isHost = true;
                  } else if (!hostIncreased && guestIncreased) {
                    isHost = false;
                  } else if (!hostIncreased && !guestIncreased) {
                    // No change detected; fall back using names if available
                    isHost = true;
                  }
                }
                console.log('[Animation] Calling triggerScoreAnimation; isHost =', isHost);
                this.triggerScoreAnimation(response.pointsAwarded, isHost);
              });
            } else {
              console.log('[Animation] rAF not available, calling triggerScoreAnimation directly');
              // Fallback without prevGame; default host
              this.triggerScoreAnimation(response.pointsAwarded, true);
            }
          }, 150);
        }
        
        setTimeout(() => {
          this.guessMessage = '';
          this.isGuessCorrect = null;
        }, 3000);
      },
      error => {
        console.error('Error submitting guess:', error);
        this.guessMessage = error.error?.message || 'Failed to submit guess';
        this.isSubmittingGuess = false;
        
        setTimeout(() => {
          this.guessMessage = '';
        }, 2000);
      });
  }

  triggerScoreAnimation(points: number, isHost: boolean, attempt: number = 0): void {
    if (!this.game) return;
    try {
      console.log('Triggering score animation. isHost =', isHost);
      
      // Use a more specific approach - query all score elements and find the right one
      const allScoreElements = document.querySelectorAll('.player-score');
      console.log(`[Animation] Attempt ${attempt} - Found score elements:`, allScoreElements.length);
      
      let scoreElement: HTMLElement | null = null;
      
      if (isHost) {
        scoreElement = allScoreElements[0] as HTMLElement; // First player is host
      } else {
        scoreElement = allScoreElements[1] as HTMLElement; // Second player is guest
      }
      console.log('[Animation] Selected score element exists:', !!scoreElement, 'isConnected:', scoreElement?.isConnected);
      
      // If not found or detached due to re-render, retry a few times
      if (!scoreElement || !scoreElement.isConnected) {
        if (attempt < 5) {
          return setTimeout(() => this.triggerScoreAnimation(points, isHost, attempt + 1), 150) as unknown as void;
        } else {
          console.error('[Animation] Could not find attached score element after retries');
          return;
        }
      }

      if (scoreElement) {
        // Create animation element
        const animationElement = document.createElement('div');
        animationElement.textContent = `+${points}`;
        
        // Set styles for golden text with black outline
        animationElement.style.position = 'absolute';
        animationElement.style.top = '-15px';
        animationElement.style.right = '-30px';
        animationElement.style.fontSize = '3rem';
        animationElement.style.fontWeight = 'bold';
        animationElement.style.color = '#FFD700';
        animationElement.style.webkitTextStroke = '2px #000';
        animationElement.style.zIndex = '100';
        animationElement.style.pointerEvents = 'none';
        animationElement.style.opacity = '1';
        animationElement.style.transform = 'translateY(0) scale(1)';
        animationElement.style.transition = 'all 2s ease-out';
        
        // Append to the score element
        scoreElement.style.position = 'relative';
        scoreElement.appendChild(animationElement);
        
        // Apply WebKit styles only to the animation element, not the score container
        animationElement.style.webkitTextStroke = "2px #000";   // black outline
        animationElement.style.webkitTextFillColor = "#FFD700";
        
        console.log('[Animation] Element created and appended, starting JS animation');
        
        // Start animation with JavaScript
        setTimeout(() => {
          animationElement.style.transform = 'translateY(-60px) scale(0.8)';
          animationElement.style.opacity = '0';
        }, 50);
        
        // Clean up after animation ends
        setTimeout(() => {
          if (animationElement.parentNode) {
            animationElement.remove();
            console.log('Animation element removed');
          }
        }, 2100);
      } else {
        console.error('Could not find score element for animation');
      }
    } catch (error) {
      console.error('Error triggering score animation:', error);
    }
  }

  handleGameEnd(): void {
    console.log('handleGameEnd called, game status:', this.game?.status);
    console.log('Current game object:', this.game);
    
    // Clear round timer when game ends
    if (this.roundTimerInterval) {
      clearInterval(this.roundTimerInterval);
      this.roundTimerInterval = null;
    }
    
    if (this.gameStateInterval) {
      this.gameStateInterval.unsubscribe();
      this.gameStateInterval = null;
    }
    
    // Force change detection to ensure UI updates
    this.cdr.detectChanges();
  }

  getFlagImageSrc(): string {
    const currentCountryId = this.game?.currentRoundData?.countryId;
    
    if (!currentCountryId) {
      this.cachedFlagUrl = '';
      this.lastCountryId = '';
      return '';
    }
    
    // Only regenerate URL if country changed
    if (currentCountryId !== this.lastCountryId) {
      this.cachedFlagUrl = `${BASIC_URL}countries/${currentCountryId}/flag`;
      this.lastCountryId = currentCountryId;
      console.log('Flag URL (new):', this.cachedFlagUrl);
    }
    
    return this.cachedFlagUrl;
  }

  getCountdownText(): string {
    if (this.startCountdown > 0) {
      return this.startCountdown.toString();
    }
    return 'GO!';
  }

  onImageError(event: any): void {
    console.error('Image failed to load:', event);
    console.log('Failed URL:', event.target.src);
  }

  onImageLoad(event: any): void {
    console.log('Image loaded successfully:', event.target.src);
  }

  getWinnerMessage(): string {
    if (!this.game || this.game.status !== 'COMPLETED') return '';
    
    if (this.game.hostScore > this.game.guestScore) {
      return `${this.game.hostName} wins!`;
    } else if (this.game.guestScore > this.game.hostScore) {
      return `${this.game.guestName} wins!`;
    } else {
      return "It's a tie!";
    }
  }
}
