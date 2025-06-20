import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-file-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, FormsModule],
  template: `
    <div class="file-dialog">
      <h2>{{ data.title }}</h2>
      <p>{{ data.message }}</p>
      
      <div *ngIf="data.type === 'import'">
        <input type="file" accept=".json" #fileInput (change)="onFileSelected($event)">
      </div>
      
      <div class="button-row">
        <button mat-button (click)="onCancel()">Cancel</button>
        <button *ngIf="data.type === 'export'" mat-raised-button color="primary" (click)="onConfirm()">Export</button>
        <button *ngIf="data.type === 'import'" mat-raised-button color="primary" [disabled]="!selectedFile" (click)="onConfirm()">Import</button>
      </div>
    </div>
  `,
  styles: [`
    .file-dialog {
      padding: 20px;
      min-width: 300px;
    }
    .button-row {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
      gap: 10px;
    }
  `]
})
export class FileDialogComponent {
  selectedFile: File | null = null;

  constructor(
    public dialogRef: MatDialogRef<FileDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      title: string; 
      message: string; 
      type: 'import' | 'export' 
    }
  ) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.data.type === 'import' && this.selectedFile) {
      this.dialogRef.close(this.selectedFile);
    } else {
      this.dialogRef.close(true);
    }
  }
}
