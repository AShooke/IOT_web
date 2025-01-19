const soundSelector = document.getElementById('sound-selector');
const soundTitle = document.getElementById('sound-title');
const playButton = document.getElementById('play-button');
const stopButton = document.getElementById('stop-button');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const menuToggle = document.getElementById('menu-toggle');
const menuPanel = document.getElementById('menu-panel');
const songHistory = document.getElementById('song-history');
const connectionStatus = document.getElementById('connection-status');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const visualizer = document.getElementById('visualizer');
const statusToggle = document.getElementById('status-toggle');
const statusPanel = document.getElementById('status-panel');

const mqttBrokerInfo = document.getElementById('mqtt-broker');
const mqttTopicInfo = document.getElementById('mqtt-topic');

const sounds = [
  { name: 'Tempo Flow'},
  { name: 'Ambient Pulse'},
  { name: 'Hip Groove'},
  { name: 'Jazz Mood'},
  { name: 'Classic Jazz'},
  { name: 'Lofi Chill'},
  { name: 'Lofi Rhythms'}
];

let currentSoundIndex = -1; // Изначально песня не выбрана
let currentSound = null;
let isPlaying = false;
let progressInterval = null;

// Заполнение селектора звуков с дополнительной информацией
sounds.forEach((sound, index) => {
  const option = document.createElement('option');
  option.value = index;
  option.textContent = `${sound.name}`;
  soundSelector.appendChild(option);
});

soundSelector.addEventListener('change', () => {
  const firstOption = soundSelector.querySelector('option[disabled]');
  if (firstOption) {
    firstOption.remove();
  }
  currentSoundIndex = parseInt(soundSelector.value);
  updateButtonStates();
});

// Используем TLS WebSocket (порт 8884 и путь /mqtt)
const mqttClient = mqtt.connect('wss://b37a444670f74de9a3e20ecd2b8c1e1b.s1.eu.hivemq.cloud:8884/mqtt', {
  username: 'METRION',
  password: 'Father.password1'
});

// Обновление информации о брокере и топике
mqttBrokerInfo.textContent = 'Broker: wss://b37a444670f74de9a3e20ecd2b8c1e1b.s1.eu.hivemq.cloud:8884/mqtt';
mqttTopicInfo.textContent = 'Topic: gw/thing/os774ef/set';

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  connectionStatus.textContent = 'Connected';
});

mqttClient.on('error', (err) => {
  console.error('MQTT connection error:', err);
  connectionStatus.textContent = 'Connection error';
});

function playCurrentSong() {
  const selectedSound = sounds[currentSoundIndex];
  if (!selectedSound) return;

  mqttClient.publish('gw/thing/os774ef/set', JSON.stringify({
    type: 'play_song',
    song: `${selectedSound.name}.mp3`
  }), (err) => {
    if (err) {
      console.error('Error publishing play_song:', err);
    } else {
      console.log(`Published play_song for ${selectedSound.name}.mp3`);
    }
  });

  soundTitle.textContent = `Current Sound: ${selectedSound.name}`;
  console.log(`Playing sound: ${selectedSound.name}`);
  isPlaying = true;
  playButton.disabled = true;
  stopButton.disabled = false;
  addToHistory(selectedSound.name);
  startVisualizer();
  startProgressBar();
}

const playSound = () => {
  playCurrentSong();
  disableButtonsTemporarily();
};

const stopSound = () => {
  if (isPlaying) {
    mqttClient.publish('gw/thing/os774ef/set', JSON.stringify({ type: 'stop_song' }), (err) => {
      if (err) {
        console.error('Error publishing stop_song:', err);
      } else {
        console.log('Published stop_song');
      }
    });
    console.log('Stopping current sound');
    soundTitle.textContent = 'Current Sound: None';
    stopVisualizer();
    stopProgressBar(); // Сбрасываем прогресс-бар при остановке трека
    isPlaying = false;
    playButton.disabled = false;
    stopButton.disabled = true;
    disableButtonsTemporarily();
  }
};

const prevSong = () => {
  currentSoundIndex = (currentSoundIndex - 1 + sounds.length) % sounds.length;
  soundSelector.value = currentSoundIndex;

  stopProgressBar();

  playCurrentSong();
  disableButtonsTemporarily();
};

const nextSong = () => {
  currentSoundIndex = (currentSoundIndex + 1) % sounds.length;
  soundSelector.value = currentSoundIndex;

  stopProgressBar();

  playCurrentSong();
  disableButtonsTemporarily();
};

function addToHistory(song) {
  const listItem = document.createElement('li');
  const songName = song.replace('.mp3', '');
  const timestamp = new Date().toLocaleTimeString();
  listItem.textContent = `${songName} - ${timestamp}`;
  listItem.classList.add('fade-in-item');
  songHistory.prepend(listItem);
}

let visualizerInterval = null;

function startVisualizer() {
  visualizer.style.width = '0%';
  let width = 0;
  visualizerInterval = setInterval(() => {
    width = (width >= 100) ? 0 : width + 1;
    visualizer.style.width = `${width}%`;
  }, 100);
}

function stopVisualizer() {
  clearInterval(visualizerInterval);
  visualizer.style.width = '0%';
}

// Управление прогресс-баром
function startProgressBar() {
  stopProgressBar();

  visualizer.style.transition = 'none';
  visualizer.style.width = '0%';

  void visualizer.offsetWidth;

  visualizer.style.transition = 'width 30s linear';
  visualizer.style.width = '100%';

  visualizer.addEventListener('transitionend', handleTransitionEnd);
}

function handleTransitionEnd() {
  visualizer.removeEventListener('transitionend', handleTransitionEnd);
  
  nextSong();
}

function stopProgressBar() {
  visualizer.removeEventListener('transitionend', handleTransitionEnd);
  
  visualizer.style.transition = 'none';
  visualizer.style.width = '0%';
}

// Темы, меню и статус
const toggleTheme = () => {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  themeIcon.textContent = isDark ? '🌙' : '🌞';
  const buttonText = isDark ? ' Switch to Light Theme' : ' Switch to Dark Theme';
  themeToggle.innerHTML = `${themeIcon.outerHTML}${buttonText}`;
};

const toggleMenu = () => {
  menuPanel.classList.toggle('hidden');
};

statusToggle.addEventListener('click', () => {
  statusPanel.classList.toggle('hidden');
  statusToggle.innerHTML = statusPanel.classList.contains('hidden')
    ? '<span class="theme-icon">🔌</span> Show Status'
    : '<span class="theme-icon">🔌</span> Hide Status';
});

playButton.addEventListener('click', playSound);
stopButton.addEventListener('click', stopSound);
prevButton.addEventListener('click', prevSong);
nextButton.addEventListener('click', nextSong);
themeToggle.addEventListener('click', toggleTheme);
menuToggle.addEventListener('click', toggleMenu);

function fetchHistory() {
  fetch('/history')
    .then(response => response.json())
    .then(data => {
      songHistory.innerHTML = '';
      data.reverse().forEach(item => {
        const listItem = document.createElement('li');
        const songName = item.song.replace('.mp3', '');
        const parsedDate = new Date(item.timestamp);
        const displayTime = isNaN(parsedDate) ? 'Unknown time' : parsedDate.toLocaleTimeString();
        
        listItem.textContent = `${songName} - ${displayTime}`;
        listItem.classList.add('fade-in-item');
        songHistory.prepend(listItem); // Добавляем в конец списка
      });
    })
    .catch(error => console.error('Error fetching history:', error));
}

fetchHistory();

const clearHistoryBtn = document.getElementById('clear-history-btn');
clearHistoryBtn.addEventListener('click', () => {
  fetch('/history', { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      songHistory.innerHTML = '';
      console.log(data.message || 'History cleared');
    })
    .catch(err => console.error('Error clearing history:', err));
});

// Функция для временного отключения кнопок
function disableButtonsTemporarily() {
  const buttons = [playButton, stopButton, prevButton, nextButton];
  buttons.forEach(button => button.disabled = true);
  setTimeout(() => {
    buttons.forEach(button => button.disabled = false);
    updateButtonStates(); // Обновляем состояние кнопок после таймера
  }, 2000); // Время в миллисекундах
}

// Функция для обновления состояния кнопок
function updateButtonStates() {
  const buttons = [playButton, stopButton, prevButton, nextButton];
  const isSongSelected = currentSoundIndex !== -1;
  buttons.forEach(button => button.disabled = !isSongSelected);
}

updateButtonStates();

const smartShuffleButton = document.getElementById('smart-shuffle-button');

smartShuffleButton.addEventListener('click', () => {
  smartShuffleButton.classList.toggle('active');
});