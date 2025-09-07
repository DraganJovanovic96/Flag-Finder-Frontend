import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GameHistoryService, GameHistoryDto, PagedGameHistoryResponse } from '../services/game-history.service';
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
  
  currentPage = 0;
  pageSize = 5;
  totalElements = 0;
  totalPages = 0;
  isFirstPage = true;
  isLastPage = true;

  totalWonGames = 0;
  totalDrawGames = 0;

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
    this.loadOverallStatistics();
    this.loadGameHistory();
  }

  loadOverallStatistics(): void {
    this.gameHistoryService.getWonGamesCount().subscribe({
      next: (count) => {
        this.totalWonGames = count;
      },
      error: (error) => {
        console.error('Failed to load won games count:', error);
      }
    });

    this.gameHistoryService.getDrawGamesCount().subscribe({
      next: (count) => {
        this.totalDrawGames = count;
      },
      error: (error) => {
        console.error('Failed to load draw games count:', error);
      }
    });
  }

  loadGameHistory(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.gameHistoryService.getUserGameHistoryPaginated(this.currentPage, this.pageSize).subscribe({
      next: (response: PagedGameHistoryResponse) => {
        this.gameHistory = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirstPage = response.first;
        this.isLastPage = response.last;
        this.loadUserProfiles(response.content);
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

  getCurrentUserGuess(round: any): any {
    const currentUserGameName = this.emailToGameNameMap.get(this.currentUserEmail);
    return round.guesses?.find((guess: any) => guess.userGameName === currentUserGameName);
  }

  getOpponentGuess(round: any, game: any): any {
    const opponentName = this.getOpponentName(game);
    return round.guesses?.find((guess: any) => guess.userGameName === opponentName);
  }

  getHostGuess(round: any, game: any): any {
    return round.guesses?.find((guess: any) => guess.userGameName === game.hostUserName);
  }

  getGuestGuess(round: any, game: any): any {
    return round.guesses?.find((guess: any) => guess.userGameName === game.guestUserName);
  }

  showTableView = false;

  toggleView(): void {
    this.showTableView = !this.showTableView;
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
    return this.totalWonGames;
  }

  getDrawGamesCount(): number {
    return this.totalDrawGames;
  }

  getCurrentUserDisplayName(game: GameHistoryDto): string {
    const currentUserGameName = this.emailToGameNameMap.get(this.currentUserEmail);
    return this.getDisplayName(currentUserGameName || '');
  }

  getOpponentDisplayName(game: GameHistoryDto): string {
    return this.getOpponentName(game);
  }

  goToFirstPage(): void {
    if (!this.isFirstPage) {
      this.currentPage = 0;
      this.loadGameHistory();
    }
  }

  goToPreviousPage(): void {
    if (!this.isFirstPage) {
      this.currentPage--;
      this.loadGameHistory();
    }
  }

  goToNextPage(): void {
    if (!this.isLastPage) {
      this.currentPage++;
      this.loadGameHistory();
    }
  }

  goToLastPage(): void {
    if (!this.isLastPage) {
      this.currentPage = this.totalPages - 1;
      this.loadGameHistory();
    }
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadGameHistory();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const startPage = Math.max(0, this.currentPage - 2);
    const endPage = Math.min(this.totalPages - 1, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  getGameNumber(index: number): number {
    return this.totalElements - (this.currentPage * this.pageSize) - index;
  }
}
