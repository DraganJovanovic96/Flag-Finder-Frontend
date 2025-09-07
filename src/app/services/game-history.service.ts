import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const BASIC_URL = environment.apiUrl;

export interface GuessDto {
  userGameName: string;
  guessedCountryName: string;
  guessedCountryId: string;
  correct: boolean;
}

export interface RoundDto {
  id: string;
  roundNumber: number;
  countryName: string;
  countryId: string;
  flagImage: string;
  timeRemaining: number | null;
  roundActive: boolean;
  guesses: GuessDto[];
}

export interface GameHistoryDto {
  roomId: string;
  hostUserName: string;
  guestUserName: string;
  winnerUserName: string | null;
  hostScore: number;
  guestScore: number;
  roundDtos: RoundDto[];
}

export interface PagedGameHistoryResponse {
  content: GameHistoryDto[];
  pageable: {
    pageNumber: number;
    pageSize: number;
  };
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GameHistoryService {

  constructor(private http: HttpClient) { }

  getUserGameHistory(): Observable<GameHistoryDto[]> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    return this.http.get<GameHistoryDto[]>(`${BASIC_URL}games/user/game-history`, { headers });
  }

  getUserGameHistoryPaginated(page: number = 0, pageSize: number = 5): Observable<PagedGameHistoryResponse> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    return this.http.get<PagedGameHistoryResponse>(`${BASIC_URL}games/user/game-history/paginated?page=${page}&pageSize=${pageSize}`, { headers });
  }

  getWonGamesCount(): Observable<number> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    return this.http.get<number>(`${BASIC_URL}games/user/won-games-count`, { headers });
  }

  getDrawGamesCount(): Observable<number> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', '*/*');

    return this.http.get<number>(`${BASIC_URL}games/user/draw-games-count`, { headers });
  }
}
