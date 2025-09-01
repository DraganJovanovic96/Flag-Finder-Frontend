import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendForgottenPasswordEmailComponent } from './send-forgotten-password-email.component';

describe('SendForgottenPasswordEmailComponent', () => {
  let component: SendForgottenPasswordEmailComponent;
  let fixture: ComponentFixture<SendForgottenPasswordEmailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendForgottenPasswordEmailComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SendForgottenPasswordEmailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
