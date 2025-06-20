import { Injectable } from '@angular/core';

// Use dynamic imports for Firebase to handle cases where the module might not be available
// This makes the code more resilient during development
let firebase: any;
let firestore: any;

// Tournament state interface to define what we're storing
export interface TournamentState {
  id?: string;         // Unique identifier for the tournament
  name?: string;       // Optional name for the tournament
  groups: any;
  matches: any;
  knockoutMatches: any[];
  totalPlayers: number;
  playersPerGroup: number;
  createdAt?: string;  // Creation timestamp
  lastUpdated?: string; // Last update timestamp
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private db: any = null;
  private useFirebase = true; // Set to true to use Firebase, false for local storage

  // Firebase config - replace with your Firebase project config when needed
  private firebaseConfig = {
    apiKey: "AIzaSyC4zXMySDL4xuhnkiZz6zDzB09vw5mCo6A",
    authDomain: "chess-tournament-62c01.firebaseapp.com",
    projectId: "chess-tournament-62c01",
    storageBucket: "chess-tournament-62c01.firebasestorage.app",
    messagingSenderId: "640305648870",
    appId: "1:640305648870:web:94ec0d04d0a3c52d53d727"
  };
  constructor() {
    // Initialize Firebase if using it
    if (this.useFirebase) {
      this.initializeFirebase();
    }
  }

  // Dynamically import and initialize Firebase
  private async initializeFirebase() {
    try {
      // Dynamically import Firebase modules
      const firebaseApp = await import('firebase/app');
      const firebaseFirestore = await import('firebase/firestore');
      
      // Store references for later use
      const app = firebaseApp.initializeApp(this.firebaseConfig);
      this.db = firebaseFirestore.getFirestore(app);
      
      // Also store the modules for other functions to use
      firebase = firebaseApp;
      firestore = firebaseFirestore;
      
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      // Fallback to local storage
      this.useFirebase = false;
    }
  }

  // Save tournament state
  async saveTournamentState(data: TournamentState): Promise<void> {
    try {
      if (this.useFirebase && this.db) {
        await this.saveToFirebase(data);
      } else {
        this.saveToLocalStorage(data);
      }
      console.log('Tournament state saved successfully');
    } catch (error) {
      console.error('Error saving tournament state:', error);
    }
  }

  // Load tournament state
  async loadTournamentState(): Promise<TournamentState | null> {
    try {
      if (this.useFirebase && this.db) {
        return await this.loadFromFirebase();
      } else {
        return this.loadFromLocalStorage();
      }
    } catch (error) {
      console.error('Error loading tournament state:', error);
      return null;
    }
  }
// Save to Firebase
private async saveToFirebase(data: TournamentState): Promise<void> {
  if (!this.db || !firestore) return;
  
  try {
    // Generate a unique ID for the tournament if it doesn't have one
    if (!data.id) {
      // Generate a timestamp-based ID for the tournament
      data.id = `tournament_${Date.now()}`;
      data.createdAt = new Date().toISOString();
    }
    
    // Always update the lastUpdated timestamp
    data.lastUpdated = new Date().toISOString();
    
    // Use the tournament's unique ID as the document ID
    const tournamentRef = firestore.doc(this.db, 'tournaments', data.id);
    
    // Save all tournament data
    await firestore.setDoc(tournamentRef, {
      id: data.id,
      name: data.name || `Tournament ${new Date().toLocaleDateString()}`,
      groups: data.groups,
      matches: data.matches,
      knockoutMatches: data.knockoutMatches,
      totalPlayers: data.totalPlayers,
      playersPerGroup: data.playersPerGroup,
      createdAt: data.createdAt,
      lastUpdated: data.lastUpdated
    });
    
    // Also update the 'current' document to point to this tournament
    const currentRef = firestore.doc(this.db, 'tournaments', 'current');
    await firestore.setDoc(currentRef, { currentTournamentId: data.id });
    
    console.log(`Tournament saved to Firestore with ID: ${data.id}`);
  } catch (error) {
    console.error('Error saving to Firestore:', error);
    // Fallback to local storage if Firestore fails
    this.saveToLocalStorage(data);
  }
}

// Load from Firebase
private async loadFromFirebase(): Promise<TournamentState | null> {
  if (!this.db || !firestore) return null;
  
  try {
    // First check the 'current' document to find the current tournament ID
    const currentRef = firestore.doc(this.db, 'tournaments', 'current');
    const currentDoc = await firestore.getDoc(currentRef);
    
    let tournamentId = 'current';
    
    if (currentDoc.exists()) {
      // Get the current tournament ID
      tournamentId = currentDoc.data().currentTournamentId;
    }
    
    // Now load the actual tournament data
    const tournamentRef = firestore.doc(this.db, 'tournaments', tournamentId);
    const docSnap = await firestore.getDoc(tournamentRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: data.id,
        name: data.name,
        groups: data.groups,
        matches: data.matches,
        knockoutMatches: data.knockoutMatches,
        totalPlayers: data.totalPlayers,
        playersPerGroup: data.playersPerGroup,
        createdAt: data.createdAt,
        lastUpdated: data.lastUpdated
      };
    } else {
      console.log('No tournament data found in Firestore - starting with new tournament');
      return null;
    }
  } catch (error) {
    console.error('Error loading from Firestore:', error);
    return this.loadFromLocalStorage(); // Fallback to local storage
  }
}

  // Save to local storage
  private saveToLocalStorage(data: TournamentState): void {
    localStorage.setItem('chessTournamentState', JSON.stringify({
      ...data,
      lastUpdated: new Date().toISOString()
    }));
  }

  // Load from local storage
  private loadFromLocalStorage(): TournamentState | null {
    const storedData = localStorage.getItem('chessTournamentState');
    if (storedData) {
      return JSON.parse(storedData);
    }
    return null;
  }

  // Clear stored data
  clearStoredData(): void {
    if (this.useFirebase && this.db) {
      console.log('To clear Firebase data, use Firebase Console or implement a delete method');
    } else {
      localStorage.removeItem('chessTournamentState');
      console.log('Local storage data cleared');
    }
  }

  // Save to file (download as JSON)
  exportToFile(data: TournamentState): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create download link and trigger download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-tournament-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // Load from file
  importFromFile(file: File): Promise<TournamentState> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          if (typeof event.target?.result === 'string') {
            const data = JSON.parse(event.target.result) as TournamentState;
            resolve(data);
          } else {
            reject(new Error('Invalid file content'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsText(file);
    });
  }

  // List all saved tournaments
  async listTournaments(): Promise<{id: string, name: string, createdAt: string}[]> {
    if (!this.db || !firestore) {
      // Return just the local one if using local storage
      const local = this.loadFromLocalStorage();
      return local ? [{
        id: 'local',
        name: 'Local Tournament',
        createdAt: local.createdAt || new Date().toISOString()
      }] : [];
    }
    
    try {
      // Get all documents from the tournaments collection except 'current'
      const tournamentsCollection = firestore.collection(this.db, 'tournaments');
      const querySnapshot = await firestore.getDocs(tournamentsCollection);
      
      const tournaments: {id: string, name: string, createdAt: string}[] = [];
      
      querySnapshot.forEach((doc: any) => {
        // Skip the 'current' document
        if (doc.id !== 'current') {
          const data = doc.data();
          tournaments.push({
            id: doc.id,
            name: data.name || `Tournament ${new Date(data.createdAt).toLocaleDateString()}`,
            createdAt: data.createdAt
          });
        }
      });
      
      // Sort by creation date, newest first
      tournaments.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      return tournaments;
    } catch (error) {
      console.error('Error listing tournaments:', error);
      return [];
    }
  }
  
  // Load a specific tournament by ID
  async loadTournamentById(tournamentId: string): Promise<TournamentState | null> {
    if (!this.db || !firestore) {
      // If using local storage, just return the current one
      return this.loadFromLocalStorage();
    }
    
    try {
      const tournamentRef = firestore.doc(this.db, 'tournaments', tournamentId);
      const docSnap = await firestore.getDoc(tournamentRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Update the 'current' pointer to this tournament
        const currentRef = firestore.doc(this.db, 'tournaments', 'current');
        await firestore.setDoc(currentRef, { currentTournamentId: tournamentId });
        
        return {
          id: data.id,
          name: data.name,
          groups: data.groups,
          matches: data.matches,
          knockoutMatches: data.knockoutMatches,
          totalPlayers: data.totalPlayers,
          playersPerGroup: data.playersPerGroup,
          createdAt: data.createdAt,
          lastUpdated: data.lastUpdated
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error loading tournament with ID ${tournamentId}:`, error);
      return null;
    }
  }
  
  // Create a new tournament (with optional name)
  async createNewTournament(name?: string): Promise<TournamentState> {
    // Create a basic empty tournament structure
    const newTournament: TournamentState = {
      id: `tournament_${Date.now()}`,
      name: name || `Tournament ${new Date().toLocaleDateString()}`,
      groups: {},
      matches: {},
      knockoutMatches: [],
      totalPlayers: 24,
      playersPerGroup: 4,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    // Save it
    await this.saveTournamentState(newTournament);
    
    return newTournament;
  }
}
