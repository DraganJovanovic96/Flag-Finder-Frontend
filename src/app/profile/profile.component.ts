import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GameHistoryService, GameHistoryDto } from '../services/game-history.service';
import { AuthService } from '../services/auth/auth.service';
import { UserProfileService } from '../services/user-profile.service';
import { environment } from '../../environments/environment';
import { forkJoin } from 'rxjs';

const BASIC_URL = environment.apiUrl;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  gameHistory: GameHistoryDto[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  currentUsername = '';
  currentUserEmail = '';
  emailToGameNameMap = new Map<string, string>();

  constructor(
    private gameHistoryService: GameHistoryService,
    private authService: AuthService,
    private userProfileService: UserProfileService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUserEmail = this.userProfileService.getCurrentUserEmail();
    this.loadGameHistory();
  }

  loadGameHistory(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.gameHistoryService.getUserGameHistory().subscribe({
      next: (history) => {
        this.gameHistory = history;
        this.loadUserProfiles(history);
      },
      error: (error) => {
        this.errorMessage = 'Failed to load game history. Please try again.';
        this.isLoading = false;
      }
    });
  }

  loadUserProfiles(history: GameHistoryDto[]): void {
    const allIdentifiers = new Set<string>();
    
    history.forEach(game => {
      if (game.hostUserName) allIdentifiers.add(game.hostUserName);
      if (game.guestUserName) allIdentifiers.add(game.guestUserName);
      if (game.winnerUserName) allIdentifiers.add(game.winnerUserName);
    });

    const identifierArray = Array.from(allIdentifiers);
    const isEmail = (str: string) => str.includes('@') && str.includes('.');
    const emails = identifierArray.filter(id => isEmail(id));
    const gameNames = identifierArray.filter(id => !isEmail(id));

    gameNames.forEach(gameName => {
      this.emailToGameNameMap.set(gameName, gameName);
    });

    if (emails.length > 0) {
      this.userProfileService.getUserProfiles(emails).subscribe({
        next: (profiles) => {
          profiles.forEach(profile => {
            this.emailToGameNameMap.set(profile.email, profile.gameName);
          });
          
          this.setCurrentUsername();
          this.isLoading = false;
        },
      });
    } else {
      this.setCurrentUsername();
      this.isLoading = false;
    }
  }

  setCurrentUsername(): void {
    this.userProfileService.getUserProfile(this.currentUserEmail).subscribe({
      next: (profile) => {
        this.emailToGameNameMap.set(profile.email, profile.gameName);
        this.currentUsername = profile.gameName;
      },
    });
  }

  getGameResult(game: GameHistoryDto): string {
    if (game.winnerUserName === null) {
      return 'Draw';
    }
    
    const currentUserGameName = this.emailToGameNameMap.get(this.currentUserEmail);
    return game.winnerUserName === currentUserGameName ? 'Won' : 'Lost';
  }

  getGameResultClass(game: GameHistoryDto): string {
    const result = this.getGameResult(game);
    return result.toLowerCase();
  }

  getUserScore(game: GameHistoryDto): number {
    const isCurrentUserHost = this.isCurrentUser(game.hostUserName);
    return isCurrentUserHost ? game.hostScore : game.guestScore;
  }

  getOpponentScore(game: GameHistoryDto): number {
    const isCurrentUserHost = this.isCurrentUser(game.hostUserName);
    return isCurrentUserHost ? game.guestScore : game.hostScore;
  }

  getOpponentName(game: GameHistoryDto): string {
    const isCurrentUserHost = this.isCurrentUser(game.hostUserName);
    const opponentIdentifier = isCurrentUserHost ? game.guestUserName : game.hostUserName;
    return this.getDisplayName(opponentIdentifier);
  }

  isCurrentUser(identifier: string): boolean {
    const currentUserGameName = this.emailToGameNameMap.get(this.currentUserEmail);
    return identifier === currentUserGameName;
  }

  getDisplayName(identifier: string): string {
    return this.emailToGameNameMap.get(identifier) || identifier;
  }

  getSortedRounds(rounds: any[]): any[] {
    return rounds.sort((a, b) => a.roundNumber - b.roundNumber);
  }

  getFlagUrl(countryId: string): string {
    return `${BASIC_URL}countries/${countryId}/flag`;
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  logout(): void {
    this.authService.logout();
  }

  getWonGamesCount(): number {
    return this.gameHistory.filter(game => this.getGameResult(game) === 'Won').length;
  }

  getDrawGamesCount(): number {
    return this.gameHistory.filter(game => this.getGameResult(game) === 'Draw').length;
  }
}
