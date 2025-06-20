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
    
    // Debug logging to check what's in matches before saving
    console.log('Matches before saving:', data.matches);
    console.log('Matches keys:', Object.keys(data.matches));
      // Special handling for the matches object - ensure it's properly converted
    let processedMatches = {};
    if (data.matches) {
      // Create a deep clone of the matches object to ensure we don't lose data
      processedMatches = JSON.parse(JSON.stringify(data.matches));
      console.log('Processed matches after JSON stringify/parse:', processedMatches);
    }
    
    // Always ensure we have createdAt and lastUpdated values
    const createdAt = data.createdAt || new Date().toISOString();
    const lastUpdated = data.lastUpdated || new Date().toISOString();
    
    // Prepare data for Firestore by deep cloning and ensuring it's serializable
    const firestoreData = {
      id: data.id,
      name: data.name || `Tournament ${new Date().toLocaleDateString()}`,
      groups: this.prepareForFirestore(data.groups),
      // Use the specially processed matches object
      matches: processedMatches,
      knockoutMatches: this.prepareForFirestore(data.knockoutMatches),
      totalPlayers: data.totalPlayers,
      playersPerGroup: data.playersPerGroup,
      createdAt: createdAt,
      lastUpdated: lastUpdated
    };
    
    console.log('Prepared matches for Firestore:', firestoreData.matches);
    console.log('Matches object keys after processing:', Object.keys(firestoreData.matches));
    
    // Use the tournament's unique ID as the document ID
    const tournamentRef = firestore.doc(this.db, 'tournaments', data.id);
    
    // Save all tournament data
    await firestore.setDoc(tournamentRef, firestoreData);
    
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
      console.log('Raw data from Firestore:', data);
      console.log('Matches from Firestore:', data.matches);
        // Process the matches object to ensure it's the correct structure
      let processedMatches = data.matches || {};
      console.log('Matches keys from Firestore before processing:', 
                Object.keys(processedMatches));
      
      // Check if matches is empty or missing appropriate structure
      if (Object.keys(processedMatches).length === 0) {
        console.warn('Matches object is empty or invalid, creating empty structure');
        // Create empty structure for each group if groups exist
        if (data.groups && Object.keys(data.groups).length > 0) {
          Object.keys(data.groups).forEach(groupKey => {
            processedMatches[groupKey] = [];
          });
        }
      }
      
      // Ensure we have valid timestamp values
      const currentTimestamp = new Date().toISOString();
        // Preserve group ordering by sorting keys and rebuilding the groups object
      const groups: {[key: string]: any} = {};
      if (data.groups) {
        // Get all group keys and sort them alphabetically (A, B, C, etc.)
        const sortedGroupKeys = Object.keys(data.groups).sort();
        
        // Rebuild the groups object with sorted keys
        sortedGroupKeys.forEach(key => {
          groups[key] = data.groups[key];
        });
        
        console.log('Group keys after sorting:', Object.keys(groups));
      }
      
      const result = {
        id: data.id,
        name: data.name,
        groups: groups || {}, // Use the sorted groups object
        matches: processedMatches,
        knockoutMatches: data.knockoutMatches || [],
        totalPlayers: data.totalPlayers || 24,
        playersPerGroup: data.playersPerGroup || 4,
        createdAt: data.createdAt || currentTimestamp,
        lastUpdated: data.lastUpdated || currentTimestamp
      };
      
      console.log('Processed tournament data:', result);
      console.log('Matches keys after processing:', Object.keys(result.matches));
      return result;
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
        console.log(`Raw data for tournament ${tournamentId} from Firestore:`, data);
        
        // Update the 'current' pointer to this tournament
        const currentRef = firestore.doc(this.db, 'tournaments', 'current');
        await firestore.setDoc(currentRef, { currentTournamentId: tournamentId });
        
        // Process the matches object to ensure it's the correct structure
        let processedMatches = data.matches || {};
        console.log('Matches keys from Firestore before processing:', Object.keys(processedMatches));
        
        // Check if matches is empty or missing appropriate structure
        if (Object.keys(processedMatches).length === 0 && data.groups && Object.keys(data.groups).length > 0) {
          console.warn('Matches object is empty or invalid, creating empty structure');
          // Create empty structure for each group if groups exist
          Object.keys(data.groups).forEach(groupKey => {
            processedMatches[groupKey] = [];
          });
        }
        
        // Preserve group ordering by sorting keys and rebuilding the groups object
        const groups: {[key: string]: any} = {};
        if (data.groups) {
          // Get all group keys and sort them alphabetically (A, B, C, etc.)
          const sortedGroupKeys = Object.keys(data.groups).sort();
          
          // Rebuild the groups object with sorted keys
          sortedGroupKeys.forEach(key => {
            groups[key] = data.groups[key];
          });
          
          console.log('Group keys after sorting in loadTournamentById:', sortedGroupKeys);
        }
        
        // Ensure we have valid timestamp values
        const currentTimestamp = new Date().toISOString();
        
        const result = {
          id: data.id,
          name: data.name,
          groups: groups, // Use the sorted groups object
          matches: processedMatches,
          knockoutMatches: data.knockoutMatches || [],
          totalPlayers: data.totalPlayers || 24,
          playersPerGroup: data.playersPerGroup || 4,
          createdAt: data.createdAt || currentTimestamp,
          lastUpdated: data.lastUpdated || currentTimestamp
        };
        
        console.log(`Processed tournament data for ${tournamentId}:`, result);
        console.log('Matches keys after processing:', Object.keys(result.matches));
        return result;
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
  // Helper method to prepare data for Firestore
  private prepareForFirestore(data: any): any {
    // Handle null or undefined
    if (data === null || data === undefined) {
      return null;
    }
    
    // Handle arrays by recursively processing each element
    if (Array.isArray(data)) {
      return data.map(item => this.prepareForFirestore(item));
    }
    
    // Handle Maps by converting to regular objects first
    if (data instanceof Map) {
      const obj: {[key: string]: any} = {};
      data.forEach((value, key) => {
        obj[key] = this.prepareForFirestore(value);
      });
      return obj;
    }
    
    // Handle regular objects (not Date, not arrays, etc)
    if (typeof data === 'object' && data !== null && !(data instanceof Date)) {
      const result: {[key: string]: any} = {};
      
      // Process each key/value pair
      for (const key in data) {
        // Skip properties that start with "_" (typically internal properties)
        if (!key.startsWith('_') && Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = this.prepareForFirestore(data[key]);
        }
      }
      
      // Special handling for empty objects - make sure we detect key/value structure
      if (Object.keys(result).length === 0 && Object.keys(data).length > 0) {
        console.warn('Detected potentially problematic empty object after serialization');
        // If the original object had keys but the result doesn't, something went wrong
        // Return the stringified version to preserve the structure
        return JSON.parse(JSON.stringify(data));
      }
      
      return result;
    }
    
    // Return primitives and other values as is
    return data;
  }
}
