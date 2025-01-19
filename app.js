// app.js

/********************************************
 * app.js — основной клиентский скрипт
 ********************************************/

// ========================
//  Элементы
// ========================
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
mqttBrokerInfo.textContent = 'Broker: wss://b37a444670f74de9a3e20ecd2b8c1e1b.s1.eu.hivemq.cloud:8884/mqtt';
mqttTopicInfo.textContent = 'Topic: gw/thing/os774ef/set';

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
  let list = isSmartShuffle ? smartOrder : normalOrder;
  if (currentIndex < 0 || currentIndex >= list.length) return;

  const song = list[currentIndex];
  mqttClient.publish('gw/thing/os774ef/set', JSON.stringify({
    type: 'play_song',
    song: `${song.name}.mp3`
  }), (err) => {
    if (err) {
      console.error('Error publishing play_song:', err);
    } else {
      console.log(`Published play_song for ${song.name}.mp3`);
    }
  });
  soundTitle.textContent = `Current Sound: ${song.name}`;
  isPlaying = true;
  playButton.disabled = true;
  stopButton.disabled = false;
  addToHistory(song.name);
  startVisualizer();
  startProgressBar();
  console.log('Playing:', song.name);
  
  // Синхронизируем select
  soundSelector.value = song.id;
}

function stopSound() {
  if (!isPlaying) return;

  mqttClient.publish('gw/thing/os774ef/set', JSON.stringify({ type:'stop_song' }), (err) => {
    if (err) {
      console.error('Error publishing stop_song:', err);
    } else {
      console.log('Published stop_song');
    }
  });
  console.log('Stopping current sound');
  isPlaying = false;
  playButton.disabled = false;
  stopButton.disabled = true;
  soundTitle.textContent = 'Current Sound: None';

  stopVisualizer();
  stopProgressBar();
  disableButtonsTemporarily();
}

function prevSong() {
  let list = isSmartShuffle ? smartOrder : normalOrder;
  if (!list.length) return;

  currentIndex = (currentIndex - 1 + list.length) % list.length;
  stopProgressBar();
  playSound();
  disableButtonsTemporarily();
}

function nextSong() {
  let list = isSmartShuffle ? smartOrder : normalOrder;
  if (!list.length) return;

  currentIndex = (currentIndex + 1) % list.length;
  stopProgressBar();
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
let visualizerInterval = null;
function startVisualizer() {
  visualizer.style.width = '0%';
  let w = 0;
  visualizerInterval = setInterval(() => {
    w = (w >= 100) ? 0 : w + 1;
    visualizer.style.width = `${w}%`;
  }, 100);
}
function stopVisualizer() {
  clearInterval(visualizerInterval);
  visualizer.style.width = '0%';
}

function startProgressBar() {
  stopProgressBar();
  visualizer.style.transition = 'none';
  visualizer.style.width = '0%';

  void visualizer.offsetWidth; // reset trick

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
