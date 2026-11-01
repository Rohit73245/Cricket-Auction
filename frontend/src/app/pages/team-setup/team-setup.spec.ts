import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeamSetup } from './team-setup';

describe('TeamSetup', () => {
  let component: TeamSetup;
  let fixture: ComponentFixture<TeamSetup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamSetup],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamSetup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
