import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { EmailVerificationComponent } from './login/email-verification-folder/email-verification/email-verification.component';
import { ResendVerificationEmailComponent } from './login/resend-email-verification-folder/resend-verification-email/resend-verification-email.component';
import { SendForgottenPasswordEmail } from './login/send-forgotten-password-email/send-forgotten-password-email/send-forgotten-password-email.component';
import { ResetPasswordComponent } from './services/reset-password/reset-password/reset-password.component';
import { ForgottenPasswordComponent } from './services/forgotten-password/forgotten-password/forgotten-password.component';
import { CreateRoomComponent } from './create-room/create-room.component';
import { RoomComponent } from './room/room.component';
import { GameComponent } from './game/game.component';

export const routes: Routes = [
    {
        path: "",
        redirectTo: '/login',
        pathMatch: 'full'
    },
    
    {
        path: "login",
        component: LoginComponent
    },

    {
        path: "create-room",
        component: CreateRoomComponent
    },

    {
        path: "room/:id",
        component: RoomComponent
    },

    {
        path: "game/:roomId",
        component: GameComponent
    },

    {
        path: "change-password",
        component: ResetPasswordComponent
    },

    {
        path: "reset-password",
        component: ForgottenPasswordComponent
    },

    {
        path: "send-password-reset",
        component: SendForgottenPasswordEmail
    },

    {
        path: "verify",
        component: EmailVerificationComponent
    },

    {
        path: "resend-email",
        component: ResendVerificationEmailComponent
    },

    { path: '**', redirectTo: '/login' }
];
