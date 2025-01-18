const mqtt = require('mqtt');
const open = require('open');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Настройка MQTT клиента
const mqttClient = mqtt.connect({
  host: '147.232.205.176',
  port: 1883,
  username: 'maker',
  password: 'mother.mqtt.password'
});

const songs = ['Song 1', 'Song 2', 'Song 3'];
let currentSong = '';

// Подписка на топик
mqttClient.on('connect', () => {
  mqttClient.subscribe('motherMQTT', (err) => {
    if (!err) {
      console.log('Subscribed to motherMQTT');
    }
  });
});

// Обработка сообщений из топика
mqttClient.on('message', (topic, message) => {
  if (topic === 'motherMQTT') {
    const data = JSON.parse(message.toString());
    if (data.type === 'play_song') {
      if (currentSong !== data.song) {
        if (currentSong) {
          publishStopSong();
        }
        currentSong = data.song;
        console.log(`Current song set to: ${currentSong}`);
        publishCurrentSong(currentSong);
      }
    } else if (data.type === 'stop_song') {
      if (currentSong) {
        console.log('Stopping current song');
        publishStopSong();
        currentSong = '';
      }
    }
  }
});

// Публикация актуальной песни в указанный топик
function publishCurrentSong(song) {
  mqttClient.publish('kpi/solaris/thing/os774ef/set', JSON.stringify({ type: 'play_song', song }), (err) => {
    if (err) {
      console.error('Error publishing play_song:', err);
    } else {
      console.log(`Published play_song for ${song}`);
    }
  });
}

// Публикация остановки песни в указанный топик
function publishStopSong() {
  mqttClient.publish('kpi/solaris/thing/os774ef/set', JSON.stringify({ type: 'stop_song' }), (err) => {
    if (err) {
      console.error('Error publishing stop_song:', err);
    } else {
      console.log('Published stop_song');
    }
  });
}

// Создание HTTP сервера для обслуживания файлов
const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') filePath = './index.html';

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css'
    // Добавьте другие типы MIME при необходимости
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code == 'ENOENT') {
        fs.readFile('./404.html', (error, content) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
        });
      }
      else {
        res.writeHead(500);
        res.end(`Sorry, check with the site admin for error: ${error.code} ..\n`);
        res.end(); 
      }
    }
    else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Запуск HTTP сервера
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  // Автоматическое открытие веб-приложения в браузере
  open(`http://localhost:${PORT}`);
});