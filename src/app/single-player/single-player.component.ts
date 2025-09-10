import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../services/auth/auth.service';
import { environment } from '../../environments/environment';

const BASIC_URL = environment.apiUrl;

interface SinglePlayerRoom {
  id: string;
  hostName: string;
  status: string;
}

@Component({
  selector: 'app-single-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './single-player.component.html',
  styleUrls: ['./single-player.component.scss']
})
export class SinglePlayerComponent implements OnInit {
  selectedContinents: string[] = [];
  availableContinents = [
    { value: 'EUROPE', label: 'Europe', flag: '🌍' },
    { value: 'ASIA', label: 'Asia', flag: '🌏' },
    { value: 'AFRICA', label: 'Africa', flag: '🌍' },
    { value: 'NORTH_AMERICA', label: 'North America', flag: '🌎' },
    { value: 'SOUTH_AMERICA', label: 'South America', flag: '🌎' },
    { value: 'OCEANIA', label: 'Oceania', flag: '🌏' },
    { value: 'USA_STATE', label: 'USA States', flag: '🇺🇸' }
  ];
  
  isCreatingRoom = false;
  isStartingGame = false;
  errorMessage: string | null = null;
  singlePlayerRoom: SinglePlayerRoom | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
  }

  toggleContinent(continent: string): void {
    const index = this.selectedContinents.indexOf(continent);
    if (index > -1) {
      this.selectedContinents.splice(index, 1);
    } else {
      this.selectedContinents.push(continent);
    }
  }

  isContinentSelected(continent: string): boolean {
    return this.selectedContinents.includes(continent);
  }

  createSinglePlayerRoom(): void {
    this.isCreatingRoom = true;
    this.errorMessage = null;

    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    const roomRequest = {
      continents: this.selectedContinents.length > 0 ? this.selectedContinents : null
    };

    this.http.post<SinglePlayerRoom>(`${BASIC_URL}rooms/create-single-player-room`, roomRequest, { headers })
      .subscribe({
        next: (room) => {
          this.singlePlayerRoom = room;
          this.isCreatingRoom = false;
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Failed to create room';
          this.isCreatingRoom = false;
        }
      });
  }

  startSinglePlayerGame(): void {
    if (!this.singlePlayerRoom) return;

    this.isStartingGame = true;
    this.errorMessage = null;

    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    const startGameRequest = {
      roomId: this.singlePlayerRoom.id,
      continents: this.selectedContinents.length > 0 ? this.selectedContinents : null
    };

    this.http.post<any>(`${BASIC_URL}games/start-single-player-game`, startGameRequest, { headers })
      .subscribe({
        next: (gameResponse) => {
          // Navigate to single player game component
          this.router.navigate(['/single-player-game', this.singlePlayerRoom!.id]);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Failed to start game';
          this.isStartingGame = false;
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  getContinentDisplayText(): string {
    if (this.selectedContinents.length === 0) {
      return 'All Continents';
    }
    if (this.selectedContinents.length === 1) {
      const continent = this.availableContinents.find(c => c.value === this.selectedContinents[0]);
      return continent ? continent.label : this.selectedContinents[0];
    }
    return `${this.selectedContinents.length} Continents`;
  }
}
