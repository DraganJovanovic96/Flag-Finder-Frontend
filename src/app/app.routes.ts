import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { CreateRoomComponent } from './create-room/create-room.component';
import { RoomComponent } from './room/room.component';
import { GameComponent } from './game/game.component';
import { ProfileComponent } from './profile/profile.component';
import { SinglePlayerComponent } from './single-player/single-player.component';
import { OAuth2CallbackComponent } from './oauth2-callback/oauth2-callback.component';
import { SetupGameNameComponent } from './setup-gamename/setup-gamename.component';
import { FriendsComponent } from './friends/friends.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'oauth2/callback', component: OAuth2CallbackComponent },
  { path: 'setup-gamename', component: SetupGameNameComponent },
  { path: 'home', component: CreateRoomComponent },
  { path: 'room/:id', component: RoomComponent },
  { path: 'game/:roomId', component: GameComponent },
  { path: 'single-player', component: SinglePlayerComponent },
  { path: 'single-player-game/:roomId', component: GameComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'friends', component: FriendsComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: '**', redirectTo: '/home' }
];
