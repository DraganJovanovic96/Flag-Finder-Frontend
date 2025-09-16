import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
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
  hostName?: string;
  guestName?: string;
  playerName?: string;
  hostScore: number;
  guestScore?: number;
  totalRounds: number;
  currentRound: number;
  status: string;
  currentRoundData?: {
    id: string;
    roundNumber: number;
    countryName: string;
    countryId: string;
    flagImage: number[];
    timeRemaining: number;
    roundActive: boolean;
  };
  currentSinglePlayerRoundData?: {
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
  
  showStartCountdown = false;
  startCountdown = 5;
  
  roundTimeRemaining = 0;
  private roundTimerInterval: any = null;
  
  userGuess = '';
  guessMessage = '';
  isSubmittingGuess = false;
  isGuessCorrect: boolean | null = null;
  
  countrySuggestions: any[] = [];
  showSuggestions = false;
  selectedSuggestionIndex = -1;
  
  private cachedFlagUrl: string = '';
  private lastCountryId: string = '';
  
  private gameStateInterval: Subscription | null = null;
  private subscriptions: Subscription[] = [];
  
  gameRounds: any[] = [];
  singlePlayerRounds: any[] = [];

  @ViewChild('guessInput') guessInput!: ElementRef<HTMLInputElement>;

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

    this.wsService.connect();
    
    this.subscriptions.push(
      this.wsService.roundStarted$.subscribe({
        next: (gameData: any) => {
          this.ngZone.run(() => {
            if (gameData && this.game && gameData.id === this.game.id) {
              this.game = gameData;
              this.roundTimeRemaining = gameData.currentRoundData?.timeRemaining || 0;
              this.startRoundTimer();
              this.userGuess = '';
              this.guessMessage = '';
              this.cdr.detectChanges();
              this.focusGuessInput();
            }
          });
        },
        error: (error) => {
        }
      })
    );

    this.subscriptions.push(
      this.wsService.gameEnded$.subscribe({
        next: (gameData: any) => {
          this.ngZone.run(() => {
            if (gameData && this.game && gameData.id === this.game.id) {
              this.game = gameData;
              this.handleGameEnd();
              this.cdr.detectChanges();
            }
          });
        },
        error: (error) => {
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
    
    this.getExistingGame();
  }

  getExistingGame(): void {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    this.http.get<Game>(`${BASIC_URL}games/room/${this.roomId}`, { headers })
      .subscribe({
        next: (response: Game) => {
          this.game = response;
          const roundData = response.currentRoundData || response.currentSinglePlayerRoundData;
          this.roundTimeRemaining = roundData?.timeRemaining || 0;
          this.isLoading = false;
          this.startGameStatePolling();
          this.startRoundTimer();
          this.focusGuessInput();
        },
        error: (error) => {
          if (error.status === 404) {
            this.startGame();
          } else {
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
        this.game = response;
        const roundData = response.currentRoundData || response.currentSinglePlayerRoundData;
        this.roundTimeRemaining = roundData?.timeRemaining || 0;
        this.isLoading = false;
        this.startGameStatePolling();
        this.startRoundTimer();
        this.focusGuessInput();
      },
      error => {
        this.errorMessage = error.error?.message || 'Failed to start game';
        this.isLoading = false;
      });
  }

  startGameStatePolling(): void {
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
        
        const roundData = response.currentRoundData || response.currentSinglePlayerRoundData;
        
        if (oldRound !== response.currentRound) {
          if (this.game?.playerName && oldRound && oldRound > 0) {
          }
          
          this.roundTimeRemaining = roundData?.timeRemaining || 0;
          this.startRoundTimer();
          this.userGuess = '';
          this.guessMessage = '';
          this.focusGuessInput();
        } else {
          const newTimeRemaining = roundData?.timeRemaining || 0;
          if (Math.abs(this.roundTimeRemaining - newTimeRemaining) > 2) {
            this.roundTimeRemaining = newTimeRemaining;
            this.startRoundTimer();
          }
        }
        
        if (response.status === 'COMPLETED') {
          this.handleGameEnd();
        }
        
        if (response.currentRound >= response.totalRounds) {
          const roundData = response.currentRoundData || response.currentSinglePlayerRoundData;
          if (!roundData?.roundActive && response.status !== 'COMPLETED') {
            this.handleGameEnd();
          }
        }
      },
      error => {
      });
  }

  startRoundTimer(): void {
    if (this.roundTimerInterval) {
      clearInterval(this.roundTimerInterval);
      this.roundTimerInterval = null;
    }
    
    const roundData = this.game?.currentRoundData || this.game?.currentSinglePlayerRoundData;
    if (!roundData?.roundActive) {
      return;
    }
    
    this.roundTimeRemaining = roundData.timeRemaining;
    
    this.roundTimerInterval = setInterval(() => {
      this.roundTimeRemaining--;
      
      if (this.roundTimeRemaining <= 0) {
        clearInterval(this.roundTimerInterval);
        this.roundTimerInterval = null;
        
        if (this.game && this.game.currentRound >= this.game.totalRounds) {
          setTimeout(() => {
            this.fetchGameState();
          }, 2000);
        }
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
        const prevGame = this.game;
        this.game = response.game;
        this.guessMessage = response.message;
        this.isSubmittingGuess = false;
        
        this.isGuessCorrect = response.correct;
        if (response.correct) {
          setTimeout(() => {
            if ('requestAnimationFrame' in window) {
              requestAnimationFrame(() => {
                let isHost = true;
                if (prevGame) {
                  const hostIncreased = response.game.hostScore > prevGame.hostScore;
                  const guestIncreased = response.game.guestScore > (prevGame.guestScore || 0);
                  if (hostIncreased && !guestIncreased) {
                    isHost = true;
                  } else if (!hostIncreased && guestIncreased) {
                    isHost = false;
                  } else if (!hostIncreased && !guestIncreased) {
                    isHost = true;
                  }
                }
                this.triggerScoreAnimation(response.pointsAwarded, isHost);
              });
            } else {
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
      const allScoreElements = document.querySelectorAll('.player-score');
      
      let scoreElement: HTMLElement | null = null;
      
      if (isHost) {
        scoreElement = allScoreElements[0] as HTMLElement;
      } else {
        scoreElement = allScoreElements[1] as HTMLElement;
      }
      if (!scoreElement || !scoreElement.isConnected) {
        if (attempt < 5) {
          return setTimeout(() => this.triggerScoreAnimation(points, isHost, attempt + 1), 150) as unknown as void;
        } else {
          return;
        }
      }

      if (scoreElement) {
        const animationElement = document.createElement('div');
        animationElement.textContent = `+${points}`;
        
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
        
        scoreElement.style.position = 'relative';
        scoreElement.appendChild(animationElement);
        
        animationElement.style.webkitTextStroke = "2px #000";
        animationElement.style.webkitTextFillColor = "#FFD700";
        
        setTimeout(() => {
          animationElement.style.transform = 'translateY(-60px) scale(0.8)';
          animationElement.style.opacity = '0';
        }, 50);
        
        setTimeout(() => {
          if (animationElement.parentNode) {
            animationElement.remove();
          }
        }, 2000);
      } else {
      }
    } catch (error) {
    }
  }

  handleGameEnd(): void {
    if (this.roundTimerInterval) {
      clearInterval(this.roundTimerInterval);
      this.roundTimerInterval = null;
    }
    
    if (this.gameStateInterval) {
      this.gameStateInterval.unsubscribe();
      this.gameStateInterval = null;
    }
    
    if (this.game && this.game.status !== 'COMPLETED') {
      this.game.status = 'COMPLETED';
    }
    
    if (this.game?.id) {
      this.fetchGameRounds();
    }
    
    this.cdr.detectChanges();
  }

  getFlagImageSrc(): string {
    const roundData = this.game?.currentRoundData || this.game?.currentSinglePlayerRoundData;
    const currentCountryId = roundData?.countryId;
    
    if (!currentCountryId) {
      this.cachedFlagUrl = '';
      this.lastCountryId = '';
      return '';
    }
    
    if (currentCountryId !== this.lastCountryId) {
      this.cachedFlagUrl = `${BASIC_URL}countries/${currentCountryId}/flag`;
      this.lastCountryId = currentCountryId;
    }
    
    return this.cachedFlagUrl;
  }

  getRoundFlagUrl(countryId: string): string {
    return `${BASIC_URL}countries/${countryId}/flag`;
  }

  getCountdownText(): string {
    if (this.startCountdown > 0) {
      return this.startCountdown.toString();
    }
    return 'GO!';
  }

  onImageError(event: any): void {
  }

  onImageLoad(event: any): void {
  }

  getWinnerMessage(): string {
    if (!this.game || this.game.status !== 'COMPLETED') return '';
    
    if (this.game.hostScore > (this.game.guestScore || 0)) {
      return `${this.game.hostName?.toUpperCase()} WINS!`;
    } else if ((this.game.guestScore || 0) > this.game.hostScore) {
      return `${this.game.guestName?.toUpperCase()} WINS!`;
    } else {
      return "It's a tie!";
    }
  }

  onGuessInput(): void {
    const query = this.userGuess.trim();
    
    if (query.length === 0) {
      this.hideSuggestions();
      return;
    }
    
    if (query.length >= 2) {
      this.searchCountries(query);
    } else {
      this.hideSuggestions();
    }
  }

  searchCountries(prefix: string): void {
    
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*')
      .set('Authorization', `Bearer ${localStorage.getItem('token')}`);

    const url = `${BASIC_URL}countries/search/bilingual?prefix=${encodeURIComponent(prefix)}`;

    this.http.get<any[]>(url, { headers })
      .subscribe({
        next: (countries) => {
          this.countrySuggestions = countries;
          this.showSuggestions = countries.length > 0 && countries.length <= 10;
          this.selectedSuggestionIndex = -1;
          this.cdr.detectChanges();
          
        },
        error: (error) => {
          this.hideSuggestions();
        }
      });
  }

  selectSuggestion(country: any): void {
    this.userGuess = country.englishName;
    this.hideSuggestions();
  }

  hideSuggestions(): void {
    this.showSuggestions = false;
    this.countrySuggestions = [];
    this.selectedSuggestionIndex = -1;
  }

  onFocusOut(): void {
    setTimeout(() => {
      this.hideSuggestions();
    }, 150);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.showSuggestions || this.countrySuggestions.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedSuggestionIndex = Math.min(
          this.selectedSuggestionIndex + 1,
          this.countrySuggestions.length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, -1);
        break;
      case 'Enter':
        if (this.selectedSuggestionIndex >= 0) {
          event.preventDefault();
          this.selectSuggestion(this.countrySuggestions[this.selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        this.hideSuggestions();
        break;
    }
  }

  fetchGameRounds(): void {
    if (!this.game?.id) return;

    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    this.http.get<any[]>(`${BASIC_URL}games/${this.game.id}/rounds`, { headers })
      .subscribe({
        next: (rounds) => {
          if (this.game?.playerName) {
            this.singlePlayerRounds = rounds;
          } else {
            this.gameRounds = rounds;
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          if (this.game?.playerName) {
            this.singlePlayerRounds = [];
          } else {
            this.gameRounds = [];
          }
          this.cdr.detectChanges();
        }
      });
  }


  hasGuessForPlayer(round: any, playerName: string): boolean {
    return round.guesses && round.guesses.some((guess: any) => guess.userGameName === playerName);
  }

  getSinglePlayerGameName(): string {
    if (this.singlePlayerRounds && this.singlePlayerRounds.length > 0) {
      for (const round of this.singlePlayerRounds) {
        if (round.guesses && round.guesses.length > 0) {
          return round.guesses[0].userGameName;
        }
      }
    }
    return this.game?.hostName || '';
  }

  getSinglePlayerEndMessage(): string {
    const score = this.game?.hostScore || 0;
    if (score === 0) {
      return 'Better luck next time! You scored 0 points.';
    } else if (score === 1) {
      return 'Not bad! You scored 1 point!';
    } else if (score <= 2) {
      return `Good effort! You scored ${score} points!`;
    } else {
      return `Great job! You scored ${score} points!`;
    }
  }

  buildSinglePlayerRoundsData(): void {
    if (!this.game?.playerName || !this.game?.totalRounds) return;
    
    this.singlePlayerRounds = [];
    for (let i = 1; i <= this.game.totalRounds; i++) {
      this.singlePlayerRounds.push({
        roundNumber: i,
        country: {
          id: `country-${i}`,
          nameOfCounty: `Round ${i} Country`
        },
        guesses: [{
          userGameName: this.game.playerName,
          correct: Math.random() > 0.5,
          guessedCountryName: `Guessed Country ${i}`
        }]
      });
    }
  }

  focusGuessInput(): void {
    setTimeout(() => {
      if (this.guessInput && this.guessInput.nativeElement) {
        this.guessInput.nativeElement.focus();
      }
    }, 100);
  }
}
