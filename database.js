const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'history.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )`, (err) => {
        if (err) {
          console.error('Error creating history table:', err.message);
        } else {
          console.log('History table is ready.');
        }
      });
      
      db.run(`CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        genre TEXT NOT NULL,
        bpm INTEGER NOT NULL,
        camelot TEXT NOT NULL,
        play_count INTEGER DEFAULT 0
      )`, (err) => {
        if (err) {
          console.error('Error creating songs table:', err.message);
        } else {
          console.log('Songs table is ready.');
          
          const insertSong = db.prepare(`
            INSERT OR IGNORE INTO songs (name, genre, bpm, camelot)
            VALUES (?, ?, ?, ?)
          `);

          const songs = [
            { name: 'Tempo Flow',    genre: 'Lo-Fi',   bpm: 75, camelot: '1A' },
            { name: 'Ambient Pulse', genre: 'Ambient', bpm: 78, camelot: '7A' },
            { name: 'Hip Groove',    genre: 'Hip-Hop', bpm: 96, camelot: '7A' },
            { name: 'Jazz Mood',     genre: 'Jazz',    bpm: 87, camelot: '8B' },
            { name: 'Classic Jazz',  genre: 'Jazz',    bpm: 85, camelot: '6B' },
            { name: 'Lofi Chill',    genre: 'Lo-Fi',   bpm: 94, camelot: '4B' },
            { name: 'Lofi Rhythms',  genre: 'Lo-Fi',   bpm: 82, camelot: '6A' }
          ];
          
          songs.forEach(song => {
            insertSong.run(song.name, song.genre, song.bpm, song.camelot, (err) => {
              if (err) {
                console.error(`Error inserting song "${song.name}":`, err.message);
              } else {
                console.log(`Inserted song: ${song.name}`);
              }
            });
          });
          
          insertSong.finalize((err) => {
            if (err) {
              console.error('Error finalizing insertSong statement:', err.message);
            } else {
              console.log('All songs have been inserted.');
            }
          });
        }
      });
    });
  }
});

module.exports = db;
