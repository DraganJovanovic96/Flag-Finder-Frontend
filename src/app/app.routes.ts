import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { CreateRoomComponent } from './create-room/create-room.component';
import { RoomComponent } from './room/room.component';
import { GameComponent } from './game/game.component';
import { ProfileComponent } from './profile/profile.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', component: CreateRoomComponent },
  { path: 'room/:id', component: RoomComponent },
  { path: 'game', component: GameComponent },
  { path: 'profile', component: ProfileComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: '**', redirectTo: '/home' }
];
