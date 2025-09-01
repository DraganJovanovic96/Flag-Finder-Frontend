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

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.createRoomForm = this.fb.group({});
  }

  ngOnInit(): void {
    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
  }

  onSubmit(): void {
    console.log('Current token:', this.authService.isAuthenticated() ? 'Present' : 'Not present');
    console.log('Checking authentication, token present:', this.authService.getToken() ? true : false);
    
    if (!this.authService.isAuthenticated()) {
      console.error('User not authenticated');
      this.errorMessage = 'Please login to create a room.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    console.log('Making API call to:', `${BASIC_URL}rooms/create`);
    // Removed spurious headers GET that caused a 200 parsing error in console

    // Auth interceptor will add the Authorization header
    this.http.post<CreateRoomResponse>(`${BASIC_URL}rooms/create`, {})
      .subscribe({
        next: (response) => {
          console.log('Room created successfully:', response);
          this.isLoading = false;
          
          // Navigate to room page with host flag - creator is automatically host
          this.router.navigate(['/room', response.id], { 
            queryParams: { isHost: 'true' } 
          });
        },
        error: (error) => {
          console.error('Error creating room:', error);
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
    // TODO: Implement browse rooms functionality
    console.log('Browse rooms functionality to be implemented');
  }

  goToProfile(): void {
    // TODO: Implement profile functionality
    console.log('Profile functionality to be implemented');
  }

  logout(): void {
    this.authService.logout();
  }
}
