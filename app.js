const soundSelector = document.getElementById('sound-selector');
const soundTitle = document.getElementById('sound-title');
const playButton = document.getElementById('play-button');
const stopButton = document.getElementById('stop-button');
const demoButton = document.getElementById('demo-button');
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

// Extra info
const mqttBrokerInfo = document.getElementById('mqtt-broker');
const mqttTopicInfo = document.getElementById('mqtt-topic');

const sounds = [
  { name: 'song1.mp3' },
  { name: 'song2.mp3' },
  { name: 'song3.mp3' },
];

let currentSoundIndex = 0;
let currentSound = null;
let isPlaying = false;

sounds.forEach((sound, index) => {
  const option = document.createElement('option');
  option.value = index;
  option.textContent = sound.name;
  soundSelector.appendChild(option);
});

soundSelector.addEventListener('change', () => {
  const firstOption = soundSelector.querySelector('option[value=""]');
  if (firstOption) {
    firstOption.remove();
  }
  currentSoundIndex = parseInt(soundSelector.value);
});

const mqttClient = mqtt.connect('ws://147.232.205.176:8000', {
  username: 'maker',
  password: 'mother.mqtt.password'
});


mqttBrokerInfo.textContent = 'Broker: ws://147.232.205.176:8000';
mqttTopicInfo.textContent = 'Topic: kpi/solaris/thing/os774ef';

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  connectionStatus.textContent = 'Connected';
});

mqttClient.on('error', (err) => {
  console.error('MQTT connection error:', err);
  connectionStatus.textContent = 'Connection error';
});

function stopCurrentSong() {
  if (isPlaying) {
    mqttClient.publish('kpi/solaris/thing/os774ef/set', JSON.stringify({ type: 'stop_song' }));
    console.log('Stopping current sound');
    soundTitle.textContent = 'Current Sound: None';
    stopVisualizer();
    isPlaying = false;
  }
  playButton.disabled = false;
  stopButton.disabled = true;
}

function playCurrentSong() {
  const selectedSound = sounds[currentSoundIndex];
  if (!selectedSound) return;

  mqttClient.publish('kpi/solaris/thing/os774ef/set', JSON.stringify({
    type: 'play_song',
    song: selectedSound.name
  }));
  soundTitle.textContent = `Current Sound: ${selectedSound.name}`;
  console.log(`Playing sound: ${selectedSound.name}`);
  isPlaying = true;
  playButton.disabled = true;
  stopButton.disabled = false;
  addToHistory(selectedSound.name);
  startVisualizer();
}

const playSound = () => {
  stopCurrentSong();
  playCurrentSong();
};

const stopSound = () => {
  stopCurrentSong();
};

const demoSound = () => {
  console.log('Playing demo sequence');
  soundTitle.textContent = 'Current Sound: Demo Sequence';
};

const prevSong = () => {
  stopCurrentSong();
  currentSoundIndex = (currentSoundIndex - 1 + sounds.length) % sounds.length;
  soundSelector.value = currentSoundIndex;
  playCurrentSong();
};

const nextSong = () => {
  stopCurrentSong();
  currentSoundIndex = (currentSoundIndex + 1) % sounds.length;
  soundSelector.value = currentSoundIndex;
  playCurrentSong();
};

function addToHistory(song) {
  const listItem = document.createElement('li');
  const timestamp = new Date().toLocaleTimeString();
  listItem.textContent = `${song} - ${timestamp}`;
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
demoButton.addEventListener('click', demoSound);
prevButton.addEventListener('click', prevSong);
nextButton.addEventListener('click', nextSong);
themeToggle.addEventListener('click', toggleTheme);
menuToggle.addEventListener('click', toggleMenu);