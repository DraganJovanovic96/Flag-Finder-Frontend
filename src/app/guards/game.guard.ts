import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { GameComponent } from '../game/game.component';

@Injectable({ providedIn: 'root' })
export class GameGuard implements CanDeactivate<GameComponent> {
  canDeactivate(component: GameComponent): boolean {
    return !(component.game?.status === 'IN_PROGRESS');
  }
}
