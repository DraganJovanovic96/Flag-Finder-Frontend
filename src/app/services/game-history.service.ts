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
}
