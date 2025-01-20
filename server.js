// server.js
const mqtt = require('mqtt');
const open = require('open');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const mqttClient = mqtt.connect({
  host: 'b37a444670f74de9a3e20ecd2b8c1e1b.s1.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts',
  username: 'METRION',
  password: 'Father.password1'
});

const PORT = 8080;

mqttClient.on('connect', () => {
  mqttClient.subscribe(['gw/thing/os774ef/set', 'gw/thing/os774ef/data', 'gw/thing/os774ef/status'], (err, granted) => {
    if (!err) {
      console.log('Subscribed to gw/thing/os774ef/set and gw/thing/os774ef/data and gw/thing/os774ef/status');
    } else {
      console.error('Subscription error:', err);
    }
  });
});


mqttClient.on('message', (topic, message, packet) => {

  if (packet.retain) {
    console.log('Ignoring retained message on topic', topic);
    return;
  }
  console.log(`Received message on topic ${topic}: ${message}`);
  
  if (topic === 'gw/thing/os774ef/set') {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'play_song') {
        const song = data.song;
        console.log(`Current song set to: ${song}`);
        saveHistory(song);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  } else if (topic === 'gw/thing/os774ef/data') {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Data message received:`, data);
      // Добавьте здесь нужную логику обработки сообщений из 'data' топика
      // Например, вы можете сохранить дополнительные данные в базу или выполнить другие действия
    } catch (error) {
      console.error('Error parsing data message:', error);
    }
  }
});

function saveHistory(song) {
  const now = new Date();
  const formattedTime = now.toISOString();
  const songName = song.replace('.mp3', '');

  db.serialize(() => {
    db.run(`
      INSERT INTO history (song, timestamp) VALUES (?, ?)
    `, [song, formattedTime], function(err) {
      if (err) {
        console.error('Error saving history:', err.message);
      } else {
        console.log(`Saved song to history (ID: ${this.lastID}) at ${formattedTime}`);
      }
    });

    db.run(`
      UPDATE songs SET play_count = play_count + 1 WHERE name = ?
    `, [songName], function(err) {
      if (err) {
        console.error('Error updating play_count:', err.message);
      } else if (this.changes === 0) {
        console.warn(`Song "${songName}" not found in songs table.`);
      } else {
        console.log(`Updated play_count for: ${songName}`);
      }
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/history' && req.method === 'GET') {
    db.all(`SELECT song, timestamp FROM history ORDER BY timestamp DESC`, [], (err, rows) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to retrieve history' }));
        console.error('Error retrieving history:', err.message);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
      console.log('Sent history data to client');
    });
  } else if (req.url === '/history' && req.method === 'DELETE') {
    db.serialize(() => {
      db.run(`DELETE FROM history`, [], function(err) {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to clear history' }));
          console.error('Error clearing history:', err.message);
          return;
        }
        console.log('History cleared successfully');

        db.run(`UPDATE songs SET play_count = 0`, [], function(err) {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to reset play_count' }));
            console.error('Error resetting play_count:', err.message);
            return;
          }
          console.log('Play counts reset successfully');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'History and play counts cleared successfully' }));
        });
      });
    });
  } else if (req.url === '/songs' && req.method === 'GET') {
    db.all(`SELECT * FROM songs`, [], (err, rows) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to retrieve songs' }));
        console.error('Error retrieving songs:', err.message);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
      console.log('Sent songs data to client');
    });
  } else {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.json': 'application/json'
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code == 'ENOENT') {
          fs.readFile('./404.html', (err404, content404) => {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content404, 'utf-8');
          });
        } else {
          res.writeHead(500);
          res.end(`Server error: ${error.code} ..\n`);
          res.end();
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  open(`http://localhost:${PORT}`)
    .then(() => console.log('Browser opened successfully'))
    .catch((err) => console.error('Error opening browser:', err));
});