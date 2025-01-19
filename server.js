const mqtt = require('mqtt');
const open = require('open');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./database');


// Настройка MQTT клиента с использованием TLS MQTT (порт 8883)
const mqttClient = mqtt.connect({
  host: 'b37a444670f74de9a3e20ecd2b8c1e1b.s1.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts', // Указываем 'mqtts' для TLS
  username: 'METRION',
  password: 'Father.password1'
});

const PORT = 8080;

// Подписка на топик
mqttClient.on('connect', () => {
  mqttClient.subscribe('gw/thing/os774ef/set', (err) => { // Изменено топик подписки
    if (!err) {
      console.log('Subscribed to gw/thing/os774ef/set');
    } else {
      console.error('Subscription error:', err);
    }
  });
});

// Обработка сообщений из топика
mqttClient.on('message', (topic, message) => {
  console.log(`Received message on topic ${topic}: ${message}`);
  if (topic === 'gw/thing/os774ef/set') {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'play_song') {
        const song = data.song;
        console.log(`Current song set to: ${song}`);
        saveHistory(song); // Сохраняем историю прослушивания и обновляем play_count
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }
});

// Сохранение истории прослушивания в базу данных и обновление play_count
function saveHistory(song) {
  const now = new Date();
  const formattedTime = now.toISOString();

  const songName = song.replace('.mp3', '');

  db.serialize(() => {
    // Вставка в history
    db.run(
      `INSERT INTO history (song, timestamp) VALUES (?, ?)`,
      [song, formattedTime],
      function(err) {
        if (err) {
          return console.error('Error saving history:', err.message);
        }
        console.log(`Saved song to history with ID: ${this.lastID} at ${formattedTime}`);
      }
    );

    // Обновление play_count в songs
    db.run(
      `UPDATE songs SET play_count = play_count + 1 WHERE name = ?`,
      [songName],
      function(err) {
        if (err) {
          return console.error('Error updating play_count:', err.message);
        }
        if (this.changes === 0) {
          console.warn(`Song "${songName}" not found in songs table.`);
        } else {
          console.log(`Updated play_count for song: ${songName}`);
        }
      }
    );
  });
}

// Создание HTTP сервера для обслуживания файлов и API
const server = http.createServer((req, res) => {
  if (req.url === '/history' && req.method === 'GET') {
    // Получение истории прослушивания из базы данных
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
    // Обработка запроса на очистку истории и сброс play_count
    db.serialize(() => {
      // Очистка таблицы history
      db.run(`DELETE FROM history`, [], function(err) {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to clear history' }));
          console.error('Error clearing history:', err.message);
          return;
        }
        console.log('History cleared successfully');

        // Сброс play_count для всех песен
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
      // Добавьте другие типы MIME при необходимости
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
          res.end(`Sorry, check with the site admin for error: ${error.code} ..\n`);
          res.end();
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }
});

// Запуск HTTP сервера
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  open(`http://localhost:${PORT}`)
    .then(() => console.log('Browser opened successfully'))
    .catch((err) => console.error('Error opening browser:', err));
});