import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { StorageService } from '../services/storage.service';

@Component({
  selector: 'app-tournament-list-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    MatButtonModule, 
    MatListModule, 
    FormsModule, 
    MatInputModule,
    MatFormFieldModule
  ],
  template: `
    <div class="tournament-list-dialog">
      <h2>{{ data.title }}</h2>
      
      <mat-form-field appearance="outline" *ngIf="data.allowCreate">
        <mat-label>New Tournament Name</mat-label>
        <input matInput [(ngModel)]="newTournamentName">
      </mat-form-field>
      
      <button *ngIf="data.allowCreate" 
              mat-raised-button 
              color="primary" 
              (click)="createNewTournament()">
        Create New Tournament
      </button>

      <h3 *ngIf="tournaments.length > 0">Saved Tournaments</h3>
      <p *ngIf="tournaments.length === 0">No saved tournaments found.</p>
      
      <mat-nav-list>
        <a mat-list-item *ngFor="let tournament of tournaments" (click)="selectTournament(tournament)">
          <span>{{ tournament.name }}</span>
          <span class="tournament-date">
            {{ formatDate(tournament.createdAt) }}
          </span>
        </a>
      </mat-nav-list>
      
      <div class="button-row">
        <button mat-button (click)="onCancel()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .tournament-list-dialog {
      padding: 20px;
      min-width: 400px;
      max-height: 600px;
      overflow-y: auto;
    }
    .button-row {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
    mat-form-field {
      width: 100%;
      margin-bottom: 16px;
    }
    .tournament-date {
      margin-left: 24px;
      font-size: 0.8em;
      color: rgba(0, 0, 0, 0.54);
    }
  `]
})
export class TournamentListDialogComponent implements OnInit {
  tournaments: {id: string, name: string, createdAt: string}[] = [];
  newTournamentName: string = '';
  
  constructor(
    public dialogRef: MatDialogRef<TournamentListDialogComponent>,
    private storageService: StorageService,
    @Inject(MAT_DIALOG_DATA) public data: { 
      title: string;
      allowCreate: boolean;
    }
  ) {}
  
  async ngOnInit() {
    // Load the list of tournaments
    this.tournaments = await this.storageService.listTournaments();
  }
  
  onCancel(): void {
    this.dialogRef.close();
  }
  
  selectTournament(tournament: {id: string, name: string, createdAt: string}): void {
    this.dialogRef.close(tournament);
  }
  
  async createNewTournament(): Promise<void> {
    if (this.newTournamentName.trim()) {
      const newTournament = await this.storageService.createNewTournament(this.newTournamentName);
      this.dialogRef.close({
        id: newTournament.id,
        name: newTournament.name,
        createdAt: newTournament.createdAt
      });
    }
  }
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
  }
}
