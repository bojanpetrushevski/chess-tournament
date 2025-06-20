import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { StorageService, TournamentState } from './services/storage.service';
interface Player {
  name: string;
  id: string;
  points: number;
  played: number;
  tiebreakPoints: number;  // Manual tiebreak points for resolving ties
}

interface Match {
  player1: string;
  player2: string;
  result1?: number;
  result2?: number;
  matchday: number;
}

interface KnockoutMatch {
  player1: string;
  player2: string;
  player1Id?: string; // Add ID to track players even if names change
  player2Id?: string; // Add ID to track players even if names change
  result1?: number;
  result2?: number;
  stage: 'round16' | 'quarterfinal' | 'semifinal' | 'final';
  matchId: number;
}

@Component({
  selector: 'app-root',
  standalone: true,  imports: [
    CommonModule, 
    FormsModule, 
    MatToolbarModule, 
    MatTableModule, 
    MatCardModule, 
    MatTabsModule, 
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
    MatIconModule,
    MatTooltipModule,
    MatListModule
  ],
  providers: [StorageService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {
  groups: { [key: string]: Player[] } = {};
  matches: { [key: string]: Match[] } = {};
  knockoutMatches: KnockoutMatch[] = [];
  qualifiedPlayers: Player[] = [];
  thirdPlaced: Player[] = [];
  bestThirdPlaced: Player[] = [];
  activeStage: 'group' | 'knockout' = 'group';
  matchdays = [1, 2, 3];
  
  // Configuration
  totalPlayers: number = 24;
  playersPerGroup: number = 4;
  minPlayers: number = 24; // Minimum players to run tournament
  playersInRound16: number = 16; // Fixed number for knockout phase
  
  // Derived values
  numGroups: number = 0;
  qualifiedPerGroup: number = 0;
  numThirdPlaced: number = 0;
  
  // State persistence
  autosave: boolean = true;
  lastSaved: Date | null = null;
  
  // Tournament management
  currentTournamentId: string | undefined;
  currentTournamentName: string = 'Chess Tournament';

  constructor(
    private storageService: StorageService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}
  
  ngOnInit() {
    // Try to load previously saved tournament state
    this.loadSavedTournament();
  }
    // Load saved tournament if available
  async loadSavedTournament() {
    const savedState = await this.storageService.loadTournamentState();
    
    if (savedState) {
      try {
        // Update tournament info
        this.currentTournamentId = savedState.id;
        this.currentTournamentName = savedState.name || 'Chess Tournament';
        
        // Restore tournament configuration
        this.totalPlayers = savedState.totalPlayers;
        this.playersPerGroup = savedState.playersPerGroup;
        
        // Calculate structure based on saved configuration
        this.calculateTournamentStructure();
        
        // Restore groups, matches, and knockout data
        this.groups = savedState.groups;
        this.matches = savedState.matches;
        this.knockoutMatches = savedState.knockoutMatches;
        
        // Recalculate derived data
        this.updateKnockouts();
        
        this.snackBar.open(`Tournament "${this.currentTournamentName}" loaded`, 'OK', { duration: 3000 });
      } catch (error) {
        console.error('Error restoring tournament state:', error);
        this.snackBar.open('Could not restore tournament state', 'OK', { duration: 3000 });
        
        // Initialize new tournament if restoration fails
        this.initNewTournament();
      }
    } else {
      // No saved state, start new tournament
      this.initNewTournament();
    }
  }
  
  // Initialize a new tournament
  initNewTournament() {
    this.calculateTournamentStructure();
    this.initGroups();
    this.scheduleMatches();
  }
  
  calculateTournamentStructure() {
    // Ensure minimum number of players
    if (this.totalPlayers < this.minPlayers) {
      this.totalPlayers = this.minPlayers;
    }
    
    // Calculate how many groups we need
    this.numGroups = Math.ceil(this.totalPlayers / this.playersPerGroup);
    
    // Calculate how many players qualify directly from each group
    this.qualifiedPerGroup = Math.floor(this.playersInRound16 / this.numGroups);
    if (this.qualifiedPerGroup > 2) this.qualifiedPerGroup = 2; // Cap at 2 players per group max
    
    // Calculate how many third-placed players we need to complete the knockout bracket
    const directQualifiers = this.numGroups * this.qualifiedPerGroup;
    this.numThirdPlaced = this.playersInRound16 - directQualifiers;
  }  initGroups() {
    // Clear existing groups
    this.groups = {};
    
    // Generate group names (A, B, C, etc.)
    const groupNames = Array.from({ length: this.numGroups }, (_, i) => 
      String.fromCharCode('A'.charCodeAt(0) + i)
    );
    
    // Initialize each group with players
    for (let g of groupNames) {
      this.groups[g] = [];
      for (let i = 1; i <= this.playersPerGroup; i++) {
        const id = `${g}${i}`;
        this.groups[g].push({ name: id, id, points: 0, played: 0, tiebreakPoints: 0 });
      }
    }
  }

  scheduleMatches() {
    for (let group in this.groups) {
      const players = this.groups[group];
      this.matches[group] = [];

      // Matchday 1
      this.matches[group].push({ player1: players[0].id, player2: players[3].id, matchday: 1 });
      this.matches[group].push({ player1: players[1].id, player2: players[2].id, matchday: 1 });

      // Matchday 2
      this.matches[group].push({ player1: players[0].id, player2: players[2].id, matchday: 2 });
      this.matches[group].push({ player1: players[1].id, player2: players[3].id, matchday: 2 });

      // Matchday 3
      this.matches[group].push({ player1: players[0].id, player2: players[1].id, matchday: 3 });
      this.matches[group].push({ player1: players[2].id, player2: players[3].id, matchday: 3 });
    }
  }

  getMatchesByMatchday(group: string, matchday: number): Match[] {
    return this.matches[group].filter(match => match.matchday === matchday);
  }

  getPlayer(group: string, id: string) {
    return this.groups[group].find(p => p.id === id);
  }  updateStandings(group: string) {
    for (let player of this.groups[group]) {
      player.points = 0;
      player.played = 0;
    }

    for (let match of this.matches[group]) {
      if (match.result1 !== undefined && match.result2 !== undefined) {
        const p1 = this.getPlayer(group, match.player1);
        const p2 = this.getPlayer(group, match.player2);
        if (p1 && p2) {
          p1.played++;
          p2.played++;
          if (match.result1 > match.result2) {
            p1.points += 1;
          } else if (match.result1 < match.result2) {
            p2.points += 1;
          } else {
            p1.points += 0.5;
            p2.points += 0.5;
          }
        }
      }
    }

    // Update knockouts to reflect new standings
    this.updateKnockouts();
    
    // Sync player names in knockout matches with their current names from groups
    this.syncKnockoutPlayerNames();
    
    // Autosave if enabled
    if (this.autosave) {
      this.saveTournament();
    }
  }updateKnockouts() {
    this.qualifiedPlayers = [];
    this.thirdPlaced = [];

    for (let group in this.groups) {
      const sorted = [...this.groups[group]].sort((a, b) => {
        // First sort by regular points
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        // If points are equal, sort by tiebreak points
        return b.tiebreakPoints - a.tiebreakPoints;
      });
      
      // Add direct qualifiers from each group
      for (let i = 0; i < this.qualifiedPerGroup; i++) {
        if (sorted[i]) {
          this.qualifiedPlayers.push(sorted[i]);
        }
      }
      
      // Add third-placed players for possible qualification
      if (sorted[this.qualifiedPerGroup]) {
        this.thirdPlaced.push(sorted[this.qualifiedPerGroup]);
      }
    }    // Sort third-placed players by points and tiebreakers
    this.bestThirdPlaced = [...this.thirdPlaced].sort((a, b) => {
      // First sort by regular points
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      // If points are equal, sort by tiebreak points - this is the critical part for qualification
      return b.tiebreakPoints - a.tiebreakPoints;
    });
      // Debug sorting
    this.logThirdPlacedSorting();
    
    // Add the required number of best third-placed players
    const qualifiedThirdPlaced = this.bestThirdPlaced.slice(0, this.numThirdPlaced);
    
    // Create a final list of qualified players for the knockout stage
    const knockoutPlayers = [...this.qualifiedPlayers, ...qualifiedThirdPlaced];
    
    console.log('Players qualifying for knockout stage:', knockoutPlayers.map(p => p.name));
    
    // Create or update the knockout matches with the qualified players
    if (knockoutPlayers.length === 16) {
      // If matches don't exist yet, create them
      if (this.knockoutMatches.length === 0) {
        this.createKnockoutMatches(knockoutPlayers);
      } else {
        // Update existing round16 matches with current qualified players
        this.updateKnockoutMatchPlayers(knockoutPlayers);
      }
    } else {
      console.warn(`Cannot create/update knockout matches: expected 16 players but got ${knockoutPlayers.length}`);
    }
  }
  
  // New method to update players in existing knockout matches
  updateKnockoutMatchPlayers(players: Player[]) {
    // Only update round16 matches - the first round of the knockout stage
    const round16Matches = this.knockoutMatches.filter(m => m.stage === 'round16');
    
    // If we don't have exactly 8 round16 matches, don't try to update them
    if (round16Matches.length !== 8) {
      console.warn('Cannot update knockout matches: expected 8 round16 matches but found', round16Matches.length);
      return;
    }
    
    // Update the player names in each match
    for (let i = 0; i < 8; i++) {
      const match = round16Matches[i];
      
      // Update player1 and player2 of each match with the current names of qualified players
      match.player1 = players[i].name;
      match.player1Id = players[i].id;
      
      match.player2 = players[15-i].name;
      match.player2Id = players[15-i].id;
    }
    
    console.log('Updated knockout matches with current qualified players');
  }
  createKnockoutMatches(players: Player[]) {
    // Round of 16
    for (let i = 0; i < 8; i++) {
      this.knockoutMatches.push({
        player1: players[i].name,
        player1Id: players[i].id, // Store player ID to track even if name changes
        player2: players[15-i].name,
        player2Id: players[15-i].id, // Store player ID to track even if name changes
        stage: 'round16',
        matchId: i + 1
      });
    }
  }  advanceKnockoutStage(stage: 'round16' | 'quarterfinal' | 'semifinal') {
    const currentMatches = this.knockoutMatches.filter(m => m.stage === stage);
    const winners: {name: string, id?: string}[] = [];
    
    // Collect winners
    for (let match of currentMatches) {
      if (match.result1 !== undefined && match.result2 !== undefined) {
        if (match.result1 > match.result2) {
          winners.push({name: match.player1, id: match.player1Id});
        } else {
          winners.push({name: match.player2, id: match.player2Id});
        }
      }
    }

    // Create next stage matches
    if (winners.length === 8 && stage === 'round16') {
      for (let i = 0; i < 4; i++) {
        this.knockoutMatches.push({
          player1: winners[i].name,
          player1Id: winners[i].id,
          player2: winners[7-i].name,
          player2Id: winners[7-i].id,
          stage: 'quarterfinal',
          matchId: i + 1
        });
      }
    } else if (winners.length === 4 && stage === 'quarterfinal') {
      this.knockoutMatches.push({
        player1: winners[0].name,
        player1Id: winners[0].id,
        player2: winners[3].name,
        player2Id: winners[3].id,
        stage: 'semifinal',
        matchId: 1
      });
      this.knockoutMatches.push({
        player1: winners[1].name,
        player1Id: winners[1].id,
        player2: winners[2].name,
        player2Id: winners[2].id,
        stage: 'semifinal',
        matchId: 2
      });
    } else if (winners.length === 2 && stage === 'semifinal') {
      this.knockoutMatches.push({
        player1: winners[0].name,
        player1Id: winners[0].id,
        player2: winners[1].name,
        player2Id: winners[1].id,
        stage: 'final',
        matchId: 1
      });
    }
    
    // Autosave if enabled
    if (this.autosave) {
      this.saveTournament();
    }
  }

  getKnockoutMatches(stage: 'round16' | 'quarterfinal' | 'semifinal' | 'final'): KnockoutMatch[] {
    return this.knockoutMatches.filter(m => m.stage === stage);
  }

  getStageWinner(): string {
    const final = this.knockoutMatches.find(m => m.stage === 'final');
    if (final && final.result1 !== undefined && final.result2 !== undefined) {
      return final.result1 > final.result2 ? final.player1 : final.player2;
    }
    return '';
  }
  getGroupNames(): string[] {
  // Return sorted group names to ensure consistent order (A, B, C, etc.)
  return Object.keys(this.groups).sort();
}

sortedGroup(groupName: string): Player[] {
  return [...this.groups[groupName]].sort((a, b) => {
    // First sort by regular points
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    // If points are equal, sort by tiebreak points
    return b.tiebreakPoints - a.tiebreakPoints;
  });
}

isQualified(player: Player): boolean {
  const group = this.getGroupForPlayer(player);
  if (group) {
    const sortedGroup = [...this.groups[group]].sort((a, b) => {
      // First sort by regular points
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      // If points are equal, sort by tiebreak points
      return b.tiebreakPoints - a.tiebreakPoints;
    });
    return sortedGroup.indexOf(player) < this.qualifiedPerGroup;
  }
  return false;
}

isBestThird(player: Player): boolean {
  // First check if the player is actually in the best third-placed list
  const index = this.bestThirdPlaced.findIndex(p => p.id === player.id);
  return index !== -1 && index < this.numThirdPlaced;
}

getGroupForPlayer(player: Player): string | null {
  for (let group in this.groups) {
    if (this.groups[group].some(p => p.id === player.id)) {
      return group;
    }
  }
  return null;
}

// Reset and recalculate tournament with new player count
resetTournament() {
  this.knockoutMatches = [];
  this.qualifiedPlayers = [];
  this.thirdPlaced = [];
  this.bestThirdPlaced = [];
  
  this.calculateTournamentStructure();
  this.initGroups();
  this.scheduleMatches();
  
  // Save the new tournament state if autosave is enabled
  if (this.autosave) {
    this.saveTournament();
  }
}

// Validate match result to only allow 0, 0.5, and 1
validateMatchResult(result: number | undefined): number {
  if (result === 0 || result === 0.5 || result === 1) {
    return result;
  }
  // If invalid value, default to 0
  return 0;
}
  // Updates all standings when tiebreak points change
  updateTiebreaks() {
    // Recalculate qualification based on updated tiebreak points
    this.updateKnockouts();
    
    // Autosave if enabled
    if (this.autosave) {
      this.saveTournament();
    }
  }

  // Debug method to log the third-placed player sorting
  logThirdPlacedSorting() {
    console.log('Third-placed players before sorting:', this.thirdPlaced);
    
    // Sort manually to verify
    const manualSorted = [...this.thirdPlaced].sort((a, b) => {
      console.log(`Comparing ${a.name} (${a.points}, ${a.tiebreakPoints}) with ${b.name} (${b.points}, ${b.tiebreakPoints})`);
      
      // First sort by regular points
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      
      // If points are equal, sort by tiebreak points
      console.log(`  Points equal, comparing tiebreak: ${a.tiebreakPoints} vs ${b.tiebreakPoints}`);
      return b.tiebreakPoints - a.tiebreakPoints;
    });
    
    console.log('Third-placed players after sorting:', manualSorted);
    console.log('Best third-placed qualifiers:', manualSorted.slice(0, this.numThirdPlaced));
  }

  // Method to find a player by ID across all groups
  findPlayerById(playerId: string | undefined): Player | undefined {
    if (!playerId) return undefined;
    
    for (const groupName in this.groups) {
      const player = this.groups[groupName].find(p => p.id === playerId);
      if (player) return player;
    }
    
    return undefined;
  }
  
  // Method to sync knockout match player names with their current names from groups
  syncKnockoutPlayerNames() {
    for (const match of this.knockoutMatches) {
      // Update player1 name if we can find them
      if (match.player1Id) {
        const player = this.findPlayerById(match.player1Id);
        if (player) {
          match.player1 = player.name;
        }
      }
      
      // Update player2 name if we can find them
      if (match.player2Id) {
        const player = this.findPlayerById(match.player2Id);
        if (player) {
          match.player2 = player.name;
        }
      }
    }
  }  // Save the current tournament state
  saveTournament() {
    // Debug the matches structure before saving
    console.log('Matches structure before save:', this.matches);
    console.log('Match keys:', Object.keys(this.matches));
    
    // Create a deep clone to ensure all nested objects are properly serialized
    // This avoids issues with object references and ensures everything becomes a plain object
    const serializedMatches = JSON.parse(JSON.stringify(this.matches));
    console.log('Serialized matches:', serializedMatches);
    
    const tournamentState: TournamentState = {
      id: this.currentTournamentId,
      name: this.currentTournamentName,
      groups: this.groups,
      matches: serializedMatches,
      knockoutMatches: this.knockoutMatches,
      totalPlayers: this.totalPlayers,
      playersPerGroup: this.playersPerGroup
    };
    
    this.storageService.saveTournamentState(tournamentState)
      .then(() => {
        this.lastSaved = new Date();
        
        // Update the current tournament ID if it was newly generated
        if (!this.currentTournamentId && tournamentState.id) {
          this.currentTournamentId = tournamentState.id;
        }
        
        this.snackBar.open(`Tournament "${this.currentTournamentName}" saved`, 'OK', { duration: 2000 });
      })
      .catch(error => {
        console.error('Error saving tournament:', error);
        this.snackBar.open('Failed to save tournament', 'OK', { duration: 2000 });
      });
  }
  
  // Toggle autosave feature
  toggleAutosave() {
    this.autosave = !this.autosave;
    this.snackBar.open(`Autosave ${this.autosave ? 'enabled' : 'disabled'}`, 'OK', { duration: 2000 });
  }
  
  // Export tournament to file
  exportTournament() {
    const tournamentState: TournamentState = {
      groups: this.groups,
      matches: this.matches,
      knockoutMatches: this.knockoutMatches,
      totalPlayers: this.totalPlayers,
      playersPerGroup: this.playersPerGroup
    };
    
    this.storageService.exportToFile(tournamentState);
    this.snackBar.open('Tournament exported successfully', 'OK', { duration: 2000 });
  }
  
  // Import tournament from file
  importTournament(file: File) {
    this.storageService.importFromFile(file)
      .then(data => {
        // Restore tournament from imported data
        this.totalPlayers = data.totalPlayers;
        this.playersPerGroup = data.playersPerGroup;
        
        this.calculateTournamentStructure();
        
        this.groups = data.groups;
        this.matches = data.matches;
        this.knockoutMatches = data.knockoutMatches;
        
        this.updateKnockouts();
        
        this.snackBar.open('Tournament imported successfully', 'OK', { duration: 3000 });
      })
      .catch(error => {
        console.error('Error importing tournament:', error);
        this.snackBar.open('Failed to import tournament', 'OK', { duration: 3000 });
      });
  }
  
  // Open import tournament dialog
  openImportDialog() {
    import('./components/file-dialog.component').then(({ FileDialogComponent }) => {
      const dialogRef = this.dialog.open(FileDialogComponent, {
        width: '400px',
        data: {
          title: 'Import Tournament',
          message: 'Select a tournament file to import:',
          type: 'import'
        }
      });
      
      dialogRef.afterClosed().subscribe(result => {
        if (result && result instanceof File) {
          this.importTournament(result);
        }
      });
    });
  }
  
  // Open export tournament dialog
  openExportDialog() {
    import('./components/file-dialog.component').then(({ FileDialogComponent }) => {
      const dialogRef = this.dialog.open(FileDialogComponent, {
        width: '400px',
        data: {
          title: 'Export Tournament',
          message: 'Do you want to export the current tournament state?',
          type: 'export'
        }
      });
      
      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.exportTournament();
        }
      });
    });
  }

  // Open the tournament list dialog to select a different tournament
  openTournamentListDialog() {
    import('./components/tournament-list-dialog.component').then(({ TournamentListDialogComponent }) => {
      const dialogRef = this.dialog.open(TournamentListDialogComponent, {
        width: '500px',
        data: {
          title: 'Select Tournament',
          allowCreate: true
        }
      });
      
      dialogRef.afterClosed().subscribe(result => {
        if (result && result.id) {
          this.loadTournament(result.id);
        }
      });
    });
  }
  
  // Create a new tournament
  async createNewTournament() {
    // Ask for a name first
    const name = prompt('Enter a name for the new tournament:');
    
    if (name !== null) {
      const newTournament = await this.storageService.createNewTournament(name || undefined);
      
      // Reset all tournament data
      this.currentTournamentId = newTournament.id;
      this.currentTournamentName = newTournament.name || 'Chess Tournament';
      
      // Initialize the tournament structure
      this.totalPlayers = 24;
      this.playersPerGroup = 4;
      this.calculateTournamentStructure();
      this.initGroups();
      this.scheduleMatches();
      
      this.snackBar.open(`Created new tournament: ${this.currentTournamentName}`, 'OK', { duration: 3000 });
    }
  }
  
  // Load a tournament by ID
  async loadTournament(tournamentId: string) {
    const tournament = await this.storageService.loadTournamentById(tournamentId);
    
    if (tournament) {
      // Update tournament data
      this.currentTournamentId = tournament.id;
      this.currentTournamentName = tournament.name || 'Chess Tournament';
      this.totalPlayers = tournament.totalPlayers;
      this.playersPerGroup = tournament.playersPerGroup;
      
      // Load the tournament data
      this.groups = tournament.groups;
      this.matches = tournament.matches;
      this.knockoutMatches = tournament.knockoutMatches;
      
      // Calculate derived values
      this.calculateTournamentStructure();
      this.updateKnockouts();
      
      this.snackBar.open(`Loaded tournament: ${this.currentTournamentName}`, 'OK', { duration: 3000 });
    } else {
      this.snackBar.open('Could not load tournament', 'OK', { duration: 3000 });
    }
  }
}
