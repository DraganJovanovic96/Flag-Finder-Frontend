import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth/auth.service';

const BASIC_URL = environment.apiUrl;

interface CreateRoomResponse {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
  hostUserName: string;
  guestUserName: string | null;
  status: string;
  gameStartedAt: string | null;
  gameEndedAt: string | null;
}

@Component({
  selector: 'app-create-room',
  standalone: true,
  templateUrl: './create-room.component.html',
  styleUrls: ['./create-room.component.scss'],
  imports: [CommonModule, ReactiveFormsModule],
})
export class CreateRoomComponent implements OnInit {
  createRoomForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  
  continents = [
    { value: 'AFRICA', label: 'Africa' },
    { value: 'ASIA', label: 'Asia' },
    { value: 'EUROPE', label: 'Europe' },
    { value: 'NORTH_AMERICA', label: 'North America' },
    { value: 'OCEANIA', label: 'Oceania' },
    { value: 'SOUTH_AMERICA', label: 'South America' },
    { value: 'USA_STATE', label: 'USA States' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.createRoomForm = this.fb.group({});
  }

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
  }

  onSubmit(): void {
    
    if (!this.authService.isAuthenticated()) {
      this.errorMessage = 'Please login to create a room.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;


    this.http.post<CreateRoomResponse>(`${BASIC_URL}rooms/create`, {})
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          
          localStorage.setItem(`room_${response.id}_isHost`, 'true');
          
          this.router.navigate(['/room', response.id]);
        },
        error: (error) => {
          this.isLoading = false;
          
          if (error.status === 401) {
            this.errorMessage = 'Session expired. Please login again.';
            setTimeout(() => {
              this.authService.logout();
            }, 2000);
          } else if (error.status === 400) {
            this.errorMessage = 'Invalid request. Please try again.';
          } else if (error.status === 409) {
            this.errorMessage = 'You already have an active room.';
          } else {
            this.errorMessage = 'Failed to create room. Please try again.';
          }
        }
      });
  }

  goToBrowseRooms(): void {
  }

  goToProfile(): void {
  }

  logout(): void {
    this.authService.logout();
  }
}
