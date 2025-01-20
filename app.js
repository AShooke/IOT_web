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
const statusToggle = document.getElementById('status-toggle');
const statusPanel = document.getElementById('status-panel');
const mqttBrokerInfo = document.getElementById('mqtt-broker');
const mqttTopicInfo = document.getElementById('mqtt-topic');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const smartShuffleButton = document.getElementById('smart-shuffle-button');

// Smart order UI
const smartOrderView = document.getElementById('smart-order-view');
const smartOrderList = document.getElementById('smart-order-list');

// ========================
//  Глобальные переменные
// ========================
let songs = [];         // Полный список из /songs
let normalOrder = [];   // Обычный порядок
let smartOrder = [];    // Умный порядок
let isSmartShuffle = false;
let currentIndex = -1;
let isPlaying = false;

// MQTT
const mqttClient = mqtt.connect('wss://b37a444670f74de9a3e20ecd2b8c1e1b.s1.eu.hivemq.cloud:8884/mqtt', {
  username: 'METRION',
  password: 'Father.password1'
});
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  connectionStatus.textContent = 'Connected';
});
mqttClient.on('error', (err) => {
  console.error('MQTT connection error:', err);
  connectionStatus.textContent = 'Connection error';
});
mqttClient.subscribe('gw/thing/os774ef/cmd');
mqttClient.subscribe('gw/thing/os774ef/data');
mqttClient.subscribe('gw/thing/os774ef/status');
mqttBrokerInfo.textContent = 'Broker: wss://b37a444670f74de9a3e20ecd2b8c1e1b.s1.eu.hivemq.cloud:8884/mqtt';
mqttTopicInfo.textContent = 'Topic: gw/thing/os774ef/set';

let currentSong = '';
let autoPlayTimer = null;
// Подписываемся на сообщения
let accessTimer = null;
let statusTimer = null;

// Function to set status to offline
function setStatusOffline() {
  console.log('Setting status to offline due to inactivity.');
  mqttClient.publish('gw/thing/os774ef/status', JSON.stringify({ status: 'offline' }), { retain: true });
  mqttClient.publish('gw/thing/os774ef/set', JSON.stringify({ type: 'stop_song', time: Date.now() }), { retain: true });
}

// Function to set access_granted to 0
function setAccessGrantedFalse() {
  console.log('Setting access_granted to 0 due to inactivity.');
  mqttClient.publish('gw/thing/os774ef/cmd', JSON.stringify({ name: 'access_granted', value: 0 }), { retain: true });
}

// Start the timers immediately upon application start
function startTimers() {
  // Start status timer
  statusTimer = setTimeout(() => {
    setStatusOffline();
  }, 30000); // 30 seconds

  // Start cmd timer
  cmdTimer = setTimeout(() => {
    setAccessGrantedFalse();
  }, 30000); // 30 seconds
}

// MQTT message handler
mqttClient.on('message', (topic, message, packet) => {
  if (packet.retain) {
    console.log('Ignoring retained message on topic', topic);
    return;
  }

  // ======= STATUS TOPIC =======
  if (topic === 'gw/thing/os774ef/status') {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Received message on topic ${topic}: ${message}`);

      if (data.status === 'online') {
        // Reset the status timer
        if (statusTimer) {
          clearTimeout(statusTimer);
        }
        statusTimer = setTimeout(() => {
          setStatusOffline();
        }, 30000); // 30 seconds
      }
    } catch (error) {
      console.error('Error parsing status message:', error);
    }
  }

  // ======= CMD TOPIC =======
  else if (topic === 'gw/thing/os774ef/cmd') {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Received message on topic ${topic}: ${message}`);

      // If access_granted = 1
      if (data.name === 'access_granted' && data.value === 1) {
        accessGranted = true;

        // Reset the cmd timer
        if (cmdTimer) {
          clearTimeout(cmdTimer);
        }
        cmdTimer = setTimeout(() => {
          setAccessGrantedFalse();
        }, 30000); // 30 seconds

        // Reset the access timer
        if (accessTimer) {
          clearTimeout(accessTimer);
        }
        accessTimer = setTimeout(() => {
          accessGranted = false;
          console.log('Access revoked due to inactivity.');
          // Add any additional logic to handle access revocation
          stopSound();
          stopVisualizer();
        }, 30000); // 30 seconds
      }
    } catch (error) {
      console.error('Error parsing cmd message:', error);
    }
  }
});

// Start the timers when the application starts
startTimers();

// ========================
//  Загрузка списка песен
// ========================
function loadSongs() {
  fetch('/songs')
    .then(res => res.json())
    .then(data => {
      songs = data; // полноценный список
      normalOrder = [...songs];
      populateSoundSelector();
      console.log('Loaded songs:', songs);
    })
    .catch(err => console.error('Error loading songs:', err));
}

// Заполняем <select> одним неизменным порядком (например, по ID возрастанию)
function populateSoundSelector() {
  soundSelector.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = 'Select a Sound';
  soundSelector.appendChild(placeholder);

  // Сортируем песни по id, чтобы был предсказуемый порядок в select
  const sortedById = [...songs].sort((a,b) => a.id - b.id);

  sortedById.forEach(song => {
    const opt = document.createElement('option');
    opt.value = song.id;  // Ставим в value именно ID
    opt.textContent = song.name;
    soundSelector.appendChild(opt);
  });
  currentIndex = -1;
  updateButtonStates();
}

// При выборе в Select (value = song.id)
soundSelector.addEventListener('change', () => {
  const val = parseInt(soundSelector.value, 10);
  if (Number.isNaN(val)) {
    currentIndex = -1;
    return;
  }
  // Ищем этот ID в текущем массиве (зависит от isSmartShuffle)
  let list = isSmartShuffle ? smartOrder : normalOrder;
  const idx = list.findIndex(s => s.id === val);
  if (idx !== -1) {
    currentIndex = idx;
    updateButtonStates();
  } else {
    // Если вдруг не нашли (например, новый трек?), ничего не делаем
    console.warn('Selected track not found in current list');
  }
});

// ========================
//  История
// ========================
function fetchHistory() {
  fetch('/history')
    .then(res => res.json())
    .then(data => {
      songHistory.innerHTML = '';
      data.reverse().forEach(item => {
        const li = document.createElement('li');
        const sn = item.song.replace('.mp3','');
        const dt = new Date(item.timestamp);
        const timeStr = isNaN(dt) ? 'Unknown time' : dt.toLocaleTimeString();
        li.textContent = `${sn} - ${timeStr}`;
        li.classList.add('fade-in-item');
        songHistory.prepend(li);
      });
    })
    .catch(err => console.error('Error fetching history:', err));
}
clearHistoryBtn.addEventListener('click', () => {
  fetch('/history', { method:'DELETE' })
    .then(res => res.json())
    .then(data => {
      songHistory.innerHTML = '';
      console.log(data.message || 'History cleared');
    })
    .catch(err => console.error('Error clearing history:', err));
});

// ========================
//  Плеер (Play/Stop/Prev/Next)
// ========================
function playSound() {
  stopSongTimer();
  playButton.disabled = true;

  let list = isSmartShuffle ? smartOrder : normalOrder;
  if (currentIndex < 0 || currentIndex >= list.length) return;

  const song = list[currentIndex];
  currentSong = `${song.name}.mp3`;
  mqttClient.publish('gw/thing/os774ef/set', JSON.stringify({
    type: 'play_song',
    song: currentSong,
    time: Date.now()
  }), { retain: true }, (err) => {
    if (err) {
      console.error('Error publishing play_song:', err);
    } else {
      console.log(`Published play_song for ${currentSong}`);
    }
  });
  soundTitle.textContent = `Current Sound: ${song.name}`;
  isPlaying = true;
  stopButton.disabled = false;
  addToHistory(song.name);
  startSongTimer();
  console.log('Playing:', song.name);

  // Синхронизируем select
  soundSelector.value = song.id;

  // Enable the play button after 2 seconds
  setTimeout(() => {
    playButton.disabled = false;
  }, 2000);
}

function stopSound() {
  if (!isPlaying) return;
  mqttClient.publish('gw/thing/os774ef/set', JSON.stringify({ type: 'stop_song', time: Date.now() }), { retain: true });
  soundTitle.textContent = `Current Sound: None`;
  isPlaying = false;
  playButton.disabled = false;
  stopButton.disabled = true;
  stopSongTimer();
}

function prevSong() {
  let list = isSmartShuffle ? smartOrder : normalOrder;
  if (!list.length) return;

  currentIndex = (currentIndex - 1 + list.length) % list.length;
  stopSongTimer();
  playSound();
  disableButtonsTemporarily();
}

function nextSong() {
  let list = isSmartShuffle ? smartOrder : normalOrder;
  if (!list.length) return;

  currentIndex = (currentIndex + 1) % list.length;
  stopSongTimer();
  playSound();
  disableButtonsTemporarily();
}

function addToHistory(songName) {
  const li = document.createElement('li');
  const n = songName.replace('.mp3','');
  const timeStr = new Date().toLocaleTimeString();
  li.textContent = `${n} - ${timeStr}`;
  li.classList.add('fade-in-item');
  songHistory.prepend(li);
}

// ========================
//  Визуализация (progress-bar)
// ========================
let songTimer = null;

// Starts a 35-second timer to play the next song
function startSongTimer() {
  if (songTimer) {
    clearTimeout(songTimer);
  }
  songTimer = setTimeout(() => {
    nextSong();
  }, 35000); // 35 seconds
}

// Stops the existing song timer
function stopSongTimer() {
  if (songTimer) {
    clearTimeout(songTimer);
    songTimer = null;
  }
}

// ========================
//  Темы, меню, статус
// ========================
function toggleTheme() {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  themeIcon.textContent = isDark ? '🌙' : '🌞';
  const buttonText = isDark ? ' Switch to Light Theme' : ' Switch to Dark Theme';
  themeToggle.innerHTML = `${themeIcon.outerHTML}${buttonText}`;
}
function toggleMenu() {
  menuPanel.classList.toggle('hidden');
}
statusToggle.addEventListener('click', () => {
  statusPanel.classList.toggle('hidden');
  statusToggle.innerHTML = statusPanel.classList.contains('hidden')
    ? '<span class="theme-icon">🔌</span> Show Status'
    : '<span class="theme-icon">🔌</span> Hide Status';
});

// ========================
//  Кнопки
// ========================
playButton.addEventListener('click', playSound);
stopButton.addEventListener('click', stopSound);
prevButton.addEventListener('click', prevSong);
nextButton.addEventListener('click', nextSong);
themeToggle.addEventListener('click', toggleTheme);
menuToggle.addEventListener('click', toggleMenu);

function disableButtonsTemporarily() {
  const btns = [playButton, stopButton, prevButton, nextButton];
  btns.forEach(b => b.disabled = true);
  setTimeout(() => {
    btns.forEach(b => b.disabled = false);
    updateButtonStates();
  }, 2000);
}
function updateButtonStates() {
  const btns = [playButton, stopButton, prevButton, nextButton];
  const isSongSelected = (currentIndex !== -1);
  btns.forEach(b => b.disabled = !isSongSelected);
}

// ========================
//  SMART SHUFFLE
// ========================
smartShuffleButton.addEventListener('click', () => {
  if (!isSmartShuffle) {
    smartShuffleButton.classList.add('active');
    enableSmartShuffle();
  } else {
    smartShuffleButton.classList.remove('active');
    disableSmartShuffle();
  }
});

function enableSmartShuffle() {
  isSmartShuffle = true;
  if (currentIndex < 0 || currentIndex >= normalOrder.length) return;

  const currentSong = normalOrder[currentIndex];
  smartOrder = buildSmartOrder(currentSong);

  // find current track in smartOrder
  const idx = smartOrder.findIndex(s => s.id === currentSong.id);
  currentIndex = (idx >= 0) ? idx : 0;

  showSmartOrder();
  // Синхронизируем select
  soundSelector.value = smartOrder[currentIndex].id;
}

function disableSmartShuffle() {
  isSmartShuffle = false;
  if (!smartOrder.length) return;

  // берем текущий трек
  let curSong = smartOrder[currentIndex];
  // ищем в normalOrder
  let idx = normalOrder.findIndex(s => s.id === curSong.id);
  if (idx >= 0) {
    normalOrder = normalOrder.slice(idx).concat(normalOrder.slice(0, idx));
    currentIndex = 0;
  }
  hideSmartOrder();
  // Синхронизируем select
  soundSelector.value = normalOrder[currentIndex].id;
}

// Отображение списка smartOrder
function showSmartOrder() {
  smartOrderView.classList.remove('hidden');
  smartOrderList.innerHTML = '';
  smartOrder.forEach((song, i) => {
    const li = document.createElement('li');
    li.textContent = `${i+1}. ${song.name}`;
    if (i === currentIndex) {
      li.style.fontWeight = 'bold';
    }
    smartOrderList.appendChild(li);
  });
}
function hideSmartOrder() {
  smartOrderView.classList.add('hidden');
  smartOrderList.innerHTML = '';
}

// Построение умного порядка
function buildSmartOrder(currentSong) {
  // Для каждого s считаем distance
  const arr = songs.map(s => {
    return { song: s, dist: calcDistance(currentSong, s) };
  });
  arr.sort((a,b) => a.dist - b.dist);
  return arr.map(x => x.song);
}

// Считаем distance (Camelot, BPM, genre, popularity)
function calcDistance(s1, s2) {
  const cDist = camelotDistance(s1.camelot, s2.camelot);
  const bpmDiff = Math.abs(s1.bpm - s2.bpm);
  const gDist = (s1.genre === s2.genre) ? 0 : 1;
  const popDiff = Math.abs(s1.play_count - s2.play_count);

  const wC = 2, wB = 0.1, wG = 5, wP = 0.05;
  return wC*cDist + wB*bpmDiff + wG*gDist + wP*popDiff;
}

function camelotDistance(c1, c2) {
  if (c1 === c2) return 0;
  const {num: n1, let: l1} = parseCamelot(c1);
  const {num: n2, let: l2} = parseCamelot(c2);
  const diffNum = Math.min(
    Math.abs(n1-n2),
    12 - Math.abs(n1-n2)
  );
  const diffLet = (l1===l2) ? 0 : 1;
  return diffNum + diffLet;
}
function parseCamelot(c) {
  const m = c.match(/^(\d{1,2})(A|B)$/);
  if (!m) return { num:0, let:'A' };
  return { num: parseInt(m[1],10), let:m[2] };
}

// ========================
//  Инициализация
// ========================
function init() {
  loadSongs();
  fetchHistory();
}
init();


//=======================================================

const accessDeniedOverlay = document.createElement('div');
accessDeniedOverlay.id = 'access-denied-overlay';
accessDeniedOverlay.innerHTML = '<div class="access-denied-message">Access Denied</div>';
document.body.appendChild(accessDeniedOverlay);

let accessGranted = false;

function checkAccess() {
  if (!accessGranted) {
    accessDeniedOverlay.classList.remove('hidden');
  } else {
    accessDeniedOverlay.classList.add('hidden');
  }
}

setInterval(checkAccess, 1000);

mqttClient.on('message', (topic, message) => {
  if (topic === 'gw/thing/os774ef/set') {
    console.log(`Received message on topic ${topic}: ${message}`);
    try {
      const data = JSON.parse(message.toString());
      if (data.name === 'access_granted') {
        accessGranted = data.value === 1;
        if (!accessGranted) {
          stopSound();
          stopVisualizer();
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }
});