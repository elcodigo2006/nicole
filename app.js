// Global State
let audioCtx = null;
let melodyInterval = null;
let isMuted = true;
let introFlowerAnim = null;
let gardenFlowerAnim = null;

// Frequencies for Kalimba Notes
const NOTE_FREQS = {
    'C4': 261.63,
    'D4': 293.66,
    'E4': 329.63,
    'F4': 349.23,
    'G4': 392.00,
    'A4': 440.00,
    'B4': 493.88,
    'C5': 523.25,
    'D5': 587.33
};

// Dreamy Pentatonic Melody Sequence
const MELODY_SEQUENCE = [
    'C4', 'E4', 'G4', 'B4', 'C5', 'B4', 'G4', 'E4',
    'D4', 'F4', 'A4', 'C5', 'D5', 'C5', 'A4', 'F4'
];
let melodyIndex = 0;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initBgParticles();
    initIntroFlower();
    setupEventListeners();
});

/* ==========================================================================
   Background Sparkles Particles
   ========================================================================== */
function initBgParticles() {
    const container = document.getElementById('bg-particles');
    const particleCount = 40;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'bg-particle';
        
        // Random sizes and positions
        const size = Math.random() * 4 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.top = `${Math.random() * 100}vh`;
        particle.style.position = 'absolute';
        particle.style.borderRadius = '50%';
        particle.style.background = `rgba(${138 + Math.random() * 100}, ${43 + Math.random() * 100}, 226, ${Math.random() * 0.4 + 0.1})`;
        particle.style.boxShadow = `0 0 ${size * 3}px rgba(138, 43, 226, 0.8)`;
        particle.style.pointerEvents = 'none';
        
        // Custom keyframe movement
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * -20;
        particle.style.animation = `drift ${duration}s infinite linear ${delay}s`;
        
        container.appendChild(particle);
    }
}

// Inject keyframe stylesheet for particle drift if not defined
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes drift {
    0% { transform: translateY(0) translateX(0) scale(1); opacity: 0.1; }
    50% { transform: translateY(-50vh) translateX(${Math.random() * 40 - 20}px) scale(1.3); opacity: 0.8; }
    100% { transform: translateY(-100vh) translateX(${Math.random() * 80 - 40}px) scale(1); opacity: 0; }
}
`;
document.head.appendChild(styleSheet);


/* ==========================================================================
   Web Audio API - Synthesizer Engine & Medley Data
   ========================================================================== */
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// Dynamic MIDI frequency conversion helper
function noteToFreq(noteStr) {
    if (!noteStr) return 0;
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = noteStr.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return 440;
    const noteName = match[1];
    const octave = parseInt(match[2], 10);
    const noteIndex = notes.indexOf(noteName);
    const midi = 12 + octave * 12 + noteIndex;
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// Track metadata for UI display (actual audio comes from MP3 files)
const medleySongs = [
    {
        title: "Stranger Things (Intro)",
        artist: "Kyle Dixon & Michael Stein",
        lyrics: "Bienvenida al Upside Down... 🌌",
        src: "stranger-intro.mp3"
    },
    {
        title: "The Upside Down",
        artist: "Kyle Dixon & Michael Stein",
        lyrics: "La oscuridad y la luz... el mundo del revés 👾",
        src: "Upside-down.mp3"
    }
];

// Player State
let currentTrackIndex = 0;
let isPlaying = false;
let visualizerAnimFrame = null;
let progressInterval = null;

// MP3 Audio Elements
let introAudio = null;
let mainAudio = null;
let introSourceNode = null;
let mainSourceNode = null;
let currentAudio = null;
let audioSourcesConnected = false;

// Audio routing nodes (Web Audio API — for visualizer + sound effects)
let delayNode = null;
let delayFeedback = null;
let masterGain = null;
let analyser = null;

// Synthesize a beautiful soft bell/harp sound for standard UI triggers (envelope, kalimba)
function playSynthNote(frequency, type = 'triangle', duration = 1.8) {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        
        // Lowpass filter to make it sound warm and cozy
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + duration * 0.8);
        
        // ADSR Envelope
        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.35, now + 0.08); // soft attack
        gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.4); // decay to sustain
        gainNode.gain.setValueAtTime(0.08, now + duration - 0.5); // sustain
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration); // release
        
        // Hook nodes together
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + duration);
    } catch (e) {
        console.error("Audio Context Error:", e);
    }
}

// Set up delayed audio connections for dreamy music-box effects
function setupAudioNodes() {
    const ctx = getAudioContext();
    if (!masterGain) {
        masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.55, ctx.currentTime); // Master volume
        
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        
        // Delay node for dreamy spacing
        delayNode = ctx.createDelay(1.0);
        delayNode.delayTime.setValueAtTime(0.38, ctx.currentTime); // 380ms echo
        
        delayFeedback = ctx.createGain();
        delayFeedback.gain.setValueAtTime(0.38, ctx.currentTime); // feedback amount
        
        // Feed delay back into itself
        delayNode.connect(delayFeedback);
        delayFeedback.connect(delayNode);
        
        // Connect Dry signal to analyser
        masterGain.connect(analyser);
        // Connect Wet (Delay) signal to analyser
        delayNode.connect(analyser);
        
        // Connect Analyser to audio output
        analyser.connect(ctx.destination);
    }
}

// Play a single note at a specific scheduled time in the AudioContext timeline
function playSynthNoteScheduled(frequency, startTime, duration = 1.0, type = 'sawtooth', volume = 0.2) {
    try {
        const ctx = getAudioContext();
        setupAudioNodes();
        
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, startTime);
        
        // Lowpass filter — higher cutoff for sawtooth to let harmonics through
        // giving it that cold, bright 80s synth character
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2500, startTime);
        filter.frequency.exponentialRampToValueAtTime(800, startTime + duration * 0.7);
        filter.Q.setValueAtTime(2.0, startTime); // slight resonance for that synth sweep
        
        // ADSR Envelope — snappy attack, moderate decay for synth stabs
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.015); // fast attack
        gainNode.gain.exponentialRampToValueAtTime(volume * 0.6, startTime + 0.12);  // decay
        gainNode.gain.setValueAtTime(volume * 0.6, startTime + duration - 0.1); // sustain
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration); // release
        
        osc.connect(filter);
        filter.connect(gainNode);
        
        // Route to Master Gain (Dry)
        gainNode.connect(masterGain);
        
        // Add delay to sawtooth lead and square pads for spacious echo
        if (type === 'sawtooth' || type === 'square') {
            gainNode.connect(delayNode);
        }
        
        osc.start(startTime);
        osc.stop(startTime + duration);
    } catch (e) {
        console.error("Scheduled Note Error:", e);
    }
}

// HTML5 Audio Playback Engine for MP3 files
function initAudioElements() {
    if (introAudio) return;
    
    introAudio = new Audio('stranger-intro.mp3');
    mainAudio = new Audio('Upside-down.mp3');
    
    introAudio.preload = 'auto';
    mainAudio.preload = 'auto';
    
    introAudio.addEventListener('ended', () => {
        if (isPlaying) {
            selectTrack(1); // Auto-advance to the main theme when intro ends
        }
    });
    
    mainAudio.loop = true;
}

function connectAudioToVisualizer(audioElement) {
    try {
        const ctx = getAudioContext();
        setupAudioNodes();
        
        if (audioElement === introAudio) {
            if (!introSourceNode) {
                introSourceNode = ctx.createMediaElementSource(introAudio);
                introSourceNode.connect(masterGain);
            }
        } else if (audioElement === mainAudio) {
            if (!mainSourceNode) {
                mainSourceNode = ctx.createMediaElementSource(mainAudio);
                mainSourceNode.connect(masterGain);
            }
        }
    } catch (e) {
        console.error("Error connecting audio element to Web Audio analyser:", e);
    }
}

function playCurrentAudio() {
    initAudioElements();
    
    const nextAudio = (currentTrackIndex === 0) ? introAudio : mainAudio;
    
    if (currentAudio && currentAudio !== nextAudio) {
        currentAudio.pause();
    }
    
    currentAudio = nextAudio;
    connectAudioToVisualizer(currentAudio);
    
    currentAudio.play().catch(e => {
        console.log("Audio play blocked or failed:", e);
    });
    
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(updateProgressBar, 250);
    
    if (!visualizerAnimFrame) {
        drawVisualizer();
    }
}

function pauseCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
    }
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

function togglePlayback() {
    isPlaying = !isPlaying;
    
    const playBtn = document.getElementById('player-play-btn');
    const floatBtn = document.getElementById('audio-toggle');
    const card = document.querySelector('.player-card');
    
    if (!playBtn || !floatBtn) return;
    
    const playIcon = playBtn.querySelector('.icon-play');
    const pauseIcon = playBtn.querySelector('.icon-pause');
    const floatMute = floatBtn.querySelector('.icon-mute');
    const floatUnmute = floatBtn.querySelector('.icon-unmute');
    const playlistTracks = document.querySelectorAll('.playlist-track');
    
    if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        
        floatMute.classList.add('hidden');
        floatUnmute.classList.remove('hidden');
        
        card.classList.add('playing');
        card.classList.remove('paused-track');
        playlistTracks.forEach(t => t.classList.remove('paused-track'));
        
        playCurrentAudio();
        
        floatBtn.querySelector('.audio-tooltip').textContent = "Pausar música";
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        
        floatMute.classList.remove('hidden');
        floatUnmute.classList.add('hidden');
        
        card.classList.remove('playing');
        card.classList.add('paused-track');
        playlistTracks.forEach(t => t.classList.add('paused-track'));
        
        pauseCurrentAudio();
        
        floatBtn.querySelector('.audio-tooltip').textContent = "Reproducir música";
    }
}

function selectTrack(trackIdx) {
    currentTrackIndex = (trackIdx + medleySongs.length) % medleySongs.length;
    
    updateActiveTrackUI();
    
    if (isPlaying) {
        playCurrentAudio();
    } else {
        togglePlayback();
    }
}

function updateActiveTrackUI() {
    const song = medleySongs[currentTrackIndex];
    if (!song) return;
    
    const titleEl = document.getElementById('player-track-title');
    const artistEl = document.getElementById('player-track-artist');
    
    if (titleEl) titleEl.textContent = song.title;
    if (artistEl) artistEl.textContent = song.artist;
    
    updateLyrics(song.lyrics);
    
    const playlistTracks = document.querySelectorAll('.playlist-track');
    playlistTracks.forEach((track, idx) => {
        if (idx === currentTrackIndex) {
            track.classList.add('active');
            const bars = track.querySelector('.playing-bars');
            if (bars) bars.classList.remove('hidden');
        } else {
            track.classList.remove('active');
            const bars = track.querySelector('.playing-bars');
            if (bars) bars.classList.add('hidden');
        }
    });
}

function updateLyrics(lyricsText) {
    const ticker = document.getElementById('player-lyrics-ticker');
    if (!ticker) return;
    
    ticker.textContent = lyricsText;
    
    const container = ticker.parentElement;
    ticker.classList.remove('scroll');
    
    if (ticker.offsetWidth > container.offsetWidth - 20) {
        ticker.classList.add('scroll');
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function updateProgressBar() {
    if (!currentAudio) return;
    
    const duration = currentAudio.duration || 0;
    const currentTime = currentAudio.currentTime || 0;
    
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    
    const fillEl = document.getElementById('player-progress-bar');
    const currentTimerEl = document.getElementById('player-time-current');
    const totalTimerEl = document.getElementById('player-time-total');
    
    if (fillEl) fillEl.style.width = `${progressPercent}%`;
    
    if (currentTimerEl) currentTimerEl.textContent = formatTime(currentTime);
    if (totalTimerEl && duration > 0) totalTimerEl.textContent = formatTime(duration);
}

// Dynamic Circular Visualizer Renderer
function drawVisualizer() {
    visualizerAnimFrame = requestAnimationFrame(drawVisualizer);
    
    const canvas = document.getElementById('player-visualizer');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;
    
    ctx.clearRect(0, 0, w, h);
    
    const baseRadius = 58;
    
    if (!analyser || !isPlaying) {
        // Draw static breathing idle ring
        const pulse = baseRadius + Math.sin(Date.now() * 0.002) * 2.2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(138, 43, 226, 0.25)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        return;
    }
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    const maxBarLength = 26;
    const numBars = 72;
    
    for (let i = 0; i < numBars; i++) {
        // Filter out very high frequency silent indices
        const dataIdx = Math.floor((i / numBars) * (bufferLength * 0.72));
        const val = dataArray[dataIdx] || 0;
        const barLength = (val / 255) * maxBarLength + 2.5;
        
        const angle = (i / numBars) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const startX = centerX + cos * baseRadius;
        const startY = centerY + sin * baseRadius;
        const endX = centerX + cos * (baseRadius + barLength);
        const endY = centerY + sin * (baseRadius + barLength);
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        
        // Beautiful color wheel transition (violet to pink)
        const hue = 275 + (i / numBars) * 60; 
        const alpha = 0.45 + (val / 255) * 0.55;
        ctx.strokeStyle = `hsla(${hue}, 88%, 66%, ${alpha})`;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
    
    // Draw pulsing inner halo ring
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
    const avg = sum / bufferLength;
    const innerRadius = baseRadius - 5 + (avg / 255) * 6.5;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(241, 91, 181, 0.4)';
    ctx.lineWidth = 2.0;
    ctx.stroke();
}

// Adjust visualizer canvas sizing
function resizeVisualizerCanvas() {
    const canvas = document.getElementById('player-visualizer');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}



/* ==========================================================================
   Procedural Blooming Flower Canvas Animation
   ========================================================================== */
function initIntroFlower() {
    const canvas = document.getElementById('flower-canvas');
    const ctx = canvas.getContext('2d');
    
    // Fit canvas to window
    function resizeCanvas() {
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    let progress = 0; // 0 to 1
    let speed = 0.0022; // Speed of bloom
    let particles = [];
    
    // Particle Class
    class PollenParticle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 1.5;
            this.vy = -Math.random() * 1.2 - 0.5;
            this.size = Math.random() * 3 + 1.5;
            this.alpha = 1;
            this.decay = Math.random() * 0.015 + 0.005;
            this.color = Math.random() > 0.4 ? '#ffd700' : '#e0aaff';
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.alpha -= this.decay;
        }
        draw(c) {
            c.save();
            c.globalAlpha = this.alpha;
            c.shadowBlur = this.size * 3;
            c.shadowColor = this.color;
            c.fillStyle = this.color;
            c.beginPath();
            c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
    }
    
    // Primary Draw Loop
    function draw() {
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;
        
        ctx.clearRect(0, 0, w, h);
        
        // Deep purple sky gradient background
        let skyGrad = ctx.createRadialGradient(w/2, h/2, 20, w/2, h/2, Math.max(w, h));
        skyGrad.addColorStop(0, '#130d2a');
        skyGrad.addColorStop(0.5, '#0a0618');
        skyGrad.addColorStop(1, '#04020a');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);
        
        // Base Flower Variables
        const startX = w / 2;
        const startY = h;
        const targetY = h * 0.5;
        const stemLength = startY - targetY;
        
        // Draw Stem
        if (progress > 0) {
            const stemProgress = Math.min(progress / 0.35, 1); // stem grows from 0% to 35% of total time
            const currentY = startY - stemLength * stemProgress;
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            // Curved stem using quadratic curve
            ctx.quadraticCurveTo(startX - 25 * Math.sin(stemProgress * Math.PI), startY - stemLength * stemProgress * 0.5, startX, currentY);
            ctx.strokeStyle = 'linear-gradient(to top, #2d5a27, #5c9e31)';
            
            // Create gradient stroke for the stem
            let stemGrad = ctx.createLinearGradient(startX, startY, startX, currentY);
            stemGrad.addColorStop(0, '#1e3f20');
            stemGrad.addColorStop(0.7, '#2b5c2d');
            stemGrad.addColorStop(1, '#509e53');
            
            ctx.strokeStyle = stemGrad;
            ctx.lineWidth = 5 * Math.min(progress * 2, 1);
            ctx.lineCap = 'round';
            ctx.stroke();
            
            // Draw Leaves (sprout between 15% and 40% progress)
            if (progress > 0.15) {
                const leafProgress = Math.min((progress - 0.15) / 0.25, 1);
                
                // Draw Left Leaf
                const leftLeafY = startY - stemLength * 0.35;
                const leftLeafScale = leafProgress * 15;
                ctx.save();
                ctx.translate(startX - 5, leftLeafY);
                ctx.rotate(-Math.PI / 4);
                ctx.beginPath();
                ctx.ellipse(0, 0, leftLeafScale, leftLeafScale * 0.4, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#387c3a';
                ctx.fill();
                ctx.strokeStyle = '#509e53';
                ctx.stroke();
                ctx.restore();
                
                // Draw Right Leaf (slightly higher up)
                if (progress > 0.22) {
                    const rightLeafProgress = Math.min((progress - 0.22) / 0.23, 1);
                    const rightLeafY = startY - stemLength * 0.55;
                    const rightLeafScale = rightLeafProgress * 12;
                    ctx.save();
                    ctx.translate(startX + 5, rightLeafY);
                    ctx.rotate(Math.PI / 4);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, rightLeafScale, rightLeafScale * 0.4, 0, 0, Math.PI * 2);
                    ctx.fillStyle = '#387c3a';
                    ctx.fill();
                    ctx.strokeStyle = '#509e53';
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }
        
        // Flower Bud (grows between 35% and 50% progress)
        if (progress > 0.35 && progress <= 0.55) {
            const budProgress = (progress - 0.35) / 0.20;
            const budSize = budProgress * 10;
            
            ctx.save();
            ctx.translate(startX, targetY);
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#8a2be2';
            
            let budGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, budSize);
            budGrad.addColorStop(0, '#5a189a');
            budGrad.addColorStop(1, '#9d4edd');
            
            ctx.fillStyle = budGrad;
            ctx.beginPath();
            ctx.arc(0, 0, budSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        // Blooming Petals (blooms between 50% and 90% progress)
        if (progress > 0.50) {
            const bloomProgress = Math.min((progress - 0.50) / 0.40, 1);
            const maxPetalRadius = Math.min(w * 0.12, h * 0.18, 90);
            const petalRadius = bloomProgress * maxPetalRadius;
            
            ctx.save();
            ctx.translate(startX, targetY);
            
            // Flower breathing/subtle wind movement
            const breathScale = 1 + Math.sin(Date.now() * 0.002) * 0.02 * bloomProgress;
            ctx.scale(breathScale, breathScale);
            
            // 5 Petals Definition: rotation angles and ratios
            const petals = [
                { angle: -Math.PI * 0.32, widthRatio: 0.72, order: 1, c1: '#4a154b', c2: '#7b2cbf', tag: 'upper' }, // Upper Left
                { angle: Math.PI * 0.32, widthRatio: 0.72, order: 1, c1: '#4a154b', c2: '#7b2cbf', tag: 'upper' },  // Upper Right
                { angle: -Math.PI * 0.72, widthRatio: 0.65, order: 2, c1: '#3c096c', c2: '#9d4edd', tag: 'side' },  // Lateral Left
                { angle: Math.PI * 0.72, widthRatio: 0.65, order: 2, c1: '#3c096c', c2: '#9d4edd', tag: 'side' },   // Lateral Right
                { angle: Math.PI, widthRatio: 0.90, order: 3, c1: '#240046', c2: '#8a2be2', tag: 'bottom' }          // Bottom Center
            ];
            
            // Draw petals sorted by drawing order (bottom layer first)
            petals.forEach(p => {
                ctx.save();
                ctx.rotate(p.angle);
                
                ctx.beginPath();
                ctx.moveTo(0, 0);
                
                // Draw petal left & right Bezier curves
                ctx.bezierCurveTo(
                    -petalRadius * p.widthRatio, -petalRadius * 0.35, 
                    -petalRadius * p.widthRatio * 0.85, -petalRadius, 
                    0, -petalRadius
                );
                ctx.bezierCurveTo(
                    petalRadius * p.widthRatio * 0.85, -petalRadius, 
                    petalRadius * p.widthRatio, -petalRadius * 0.35, 
                    0, 0
                );
                ctx.closePath();
                
                // Beautiful radial color gradient for petal
                let petalGrad = ctx.createRadialGradient(0, 0, petalRadius * 0.05, 0, -petalRadius * 0.6, petalRadius);
                petalGrad.addColorStop(0, p.c1); // Deep core
                petalGrad.addColorStop(0.5, p.c2); // Soft center
                petalGrad.addColorStop(0.9, '#c77dff'); // Vibrant tip
                petalGrad.addColorStop(1.0, '#e0aaff'); // Soft glowing outline
                
                ctx.shadowBlur = 15 * bloomProgress;
                ctx.shadowColor = 'rgba(138, 43, 226, 0.4)';
                
                ctx.fillStyle = petalGrad;
                ctx.fill();
                
                // Petal details/lines
                ctx.strokeStyle = 'rgba(24, 2, 45, 0.25)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -petalRadius * 0.9);
                ctx.stroke();
                
                // Bottom petal gets special yellow-gold highlights (characteristic of viola flowers)
                if (p.tag === 'bottom' && bloomProgress > 0.4) {
                    const localProg = (bloomProgress - 0.4) / 0.6;
                    ctx.save();
                    // Draw gold base shape
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.bezierCurveTo(
                        -petalRadius * 0.25 * localProg, -petalRadius * 0.1,
                        -petalRadius * 0.2 * localProg, -petalRadius * 0.4 * localProg,
                        0, -petalRadius * 0.45 * localProg
                    );
                    ctx.bezierCurveTo(
                        petalRadius * 0.2 * localProg, -petalRadius * 0.4 * localProg,
                        petalRadius * 0.25 * localProg, -petalRadius * 0.1,
                        0, 0
                    );
                    
                    let goldGrad = ctx.createRadialGradient(0, 0, 1, 0, -petalRadius * 0.15, petalRadius * 0.35);
                    goldGrad.addColorStop(0, '#ffffff');
                    goldGrad.addColorStop(0.3, '#ffd700'); // Gold
                    goldGrad.addColorStop(0.8, '#ff9e00'); // Orange
                    goldGrad.addColorStop(1, 'transparent');
                    
                    ctx.fillStyle = goldGrad;
                    ctx.fill();
                    
                    // Dark purple stripes stretching outwards from the gold core
                    ctx.strokeStyle = '#10002b';
                    ctx.lineWidth = 1.5;
                    for (let angleOff = -0.3; angleOff <= 0.3; angleOff += 0.12) {
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        const endX = Math.sin(angleOff) * petalRadius * 0.5;
                        const endY = -Math.cos(angleOff) * petalRadius * 0.5;
                        ctx.quadraticCurveTo(endX * 0.5, endY * 0.4, endX, endY);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
                
                ctx.restore();
            });
            
            // Flower Center Core (Pistils & Stamens)
            if (bloomProgress > 0.6) {
                const coreProgress = (bloomProgress - 0.6) / 0.4;
                
                ctx.save();
                // Glowing golden sphere center
                let centerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, petalRadius * 0.15 * coreProgress);
                centerGlow.addColorStop(0, '#ffffff');
                centerGlow.addColorStop(0.4, '#ffd700');
                centerGlow.addColorStop(0.8, 'rgba(255, 215, 0, 0.4)');
                centerGlow.addColorStop(1.0, 'transparent');
                
                ctx.fillStyle = centerGlow;
                ctx.beginPath();
                ctx.arc(0, 0, petalRadius * 0.15, 0, Math.PI*2);
                ctx.fill();
                
                // Spawn pollen particles continuously once center is open
                if (Math.random() < 0.28 && progress < 0.99) {
                    particles.push(new PollenParticle(startX + (Math.random() - 0.5) * 10, targetY + (Math.random() - 0.5) * 10));
                }
                ctx.restore();
            }
            ctx.restore();
        }
        
        // Update and draw pollen particles
        particles = particles.filter(p => {
            p.update();
            p.draw(ctx);
            return p.alpha > 0;
        });
        
        // Update blooming progress
        if (progress < 1) {
            progress += speed;
            introFlowerAnim = requestAnimationFrame(draw);
        } else {
            // Animation finished! Slowly fade in the "Discover" button
            cancelAnimationFrame(introFlowerAnim);
            const enterBtn = document.getElementById('enter-btn');
            enterBtn.classList.remove('hidden-btn');
            enterBtn.classList.add('visible-btn');
            
            // Keep drawing the idle breathing & drifting particles
            idleDrawLoop();
        }
    }
    
    // Idle loop to keep the flower breathing after fully bloomed
    function idleDrawLoop() {
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;
        
        ctx.clearRect(0, 0, w, h);
        
        let skyGrad = ctx.createRadialGradient(w/2, h/2, 20, w/2, h/2, Math.max(w, h));
        skyGrad.addColorStop(0, '#130d2a');
        skyGrad.addColorStop(0.5, '#0a0618');
        skyGrad.addColorStop(1, '#04020a');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);
        
        const startX = w / 2;
        const startY = h;
        const targetY = h * 0.5;
        const stemLength = startY - targetY;
        
        // Draw Static Stem
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(startX - 25, startY - stemLength * 0.5, startX, targetY);
        
        let stemGrad = ctx.createLinearGradient(startX, startY, startX, targetY);
        stemGrad.addColorStop(0, '#1e3f20');
        stemGrad.addColorStop(0.7, '#2b5c2d');
        stemGrad.addColorStop(1, '#509e53');
        ctx.strokeStyle = stemGrad;
        ctx.lineWidth = 5;
        ctx.stroke();
        
        // Draw static leaves
        ctx.save();
        ctx.translate(startX - 5, startY - stemLength * 0.35);
        ctx.rotate(-Math.PI / 4);
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#387c3a';
        ctx.fill();
        ctx.strokeStyle = '#509e53';
        ctx.stroke();
        ctx.restore();
        
        ctx.save();
        ctx.translate(startX + 5, startY - stemLength * 0.55);
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 4.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#387c3a';
        ctx.fill();
        ctx.strokeStyle = '#509e53';
        ctx.stroke();
        ctx.restore();
        
        // Draw breathing flower
        ctx.save();
        ctx.translate(startX, targetY);
        
        const breathScale = 1 + Math.sin(Date.now() * 0.0015) * 0.015;
        ctx.scale(breathScale, breathScale);
        
        const maxPetalRadius = Math.min(w * 0.12, h * 0.18, 90);
        
        const petals = [
            { angle: -Math.PI * 0.32, widthRatio: 0.72, c1: '#4a154b', c2: '#7b2cbf', tag: 'upper' },
            { angle: Math.PI * 0.32, widthRatio: 0.72, c1: '#4a154b', c2: '#7b2cbf', tag: 'upper' },
            { angle: -Math.PI * 0.72, widthRatio: 0.65, c1: '#3c096c', c2: '#9d4edd', tag: 'side' },
            { angle: Math.PI * 0.72, widthRatio: 0.65, c1: '#3c096c', c2: '#9d4edd', tag: 'side' },
            { angle: Math.PI, widthRatio: 0.90, c1: '#240046', c2: '#8a2be2', tag: 'bottom' }
        ];
        
        petals.forEach(p => {
            ctx.save();
            ctx.rotate(p.angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(
                -maxPetalRadius * p.widthRatio, -maxPetalRadius * 0.35, 
                -maxPetalRadius * p.widthRatio * 0.85, -maxPetalRadius, 
                0, -maxPetalRadius
            );
            ctx.bezierCurveTo(
                maxPetalRadius * p.widthRatio * 0.85, -maxPetalRadius, 
                maxPetalRadius * p.widthRatio, -maxPetalRadius * 0.35, 
                0, 0
            );
            ctx.closePath();
            
            let petalGrad = ctx.createRadialGradient(0, 0, maxPetalRadius * 0.05, 0, -maxPetalRadius * 0.6, maxPetalRadius);
            petalGrad.addColorStop(0, p.c1);
            petalGrad.addColorStop(0.5, p.c2);
            petalGrad.addColorStop(0.9, '#c77dff');
            petalGrad.addColorStop(1.0, '#e0aaff');
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(138, 43, 226, 0.4)';
            ctx.fillStyle = petalGrad;
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(24, 2, 45, 0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -maxPetalRadius * 0.9);
            ctx.stroke();
            
            if (p.tag === 'bottom') {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(-maxPetalRadius * 0.25, -maxPetalRadius * 0.1, -maxPetalRadius * 0.2, -maxPetalRadius * 0.4, 0, -maxPetalRadius * 0.45);
                ctx.bezierCurveTo(maxPetalRadius * 0.2, -maxPetalRadius * 0.4, maxPetalRadius * 0.25, -maxPetalRadius * 0.1, 0, 0);
                
                let goldGrad = ctx.createRadialGradient(0, 0, 1, 0, -maxPetalRadius * 0.15, maxPetalRadius * 0.35);
                goldGrad.addColorStop(0, '#ffffff');
                goldGrad.addColorStop(0.3, '#ffd700');
                goldGrad.addColorStop(0.8, '#ff9e00');
                goldGrad.addColorStop(1, 'transparent');
                
                ctx.fillStyle = goldGrad;
                ctx.fill();
                
                ctx.strokeStyle = '#10002b';
                ctx.lineWidth = 1.5;
                for (let angleOff = -0.3; angleOff <= 0.3; angleOff += 0.12) {
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    const endX = Math.sin(angleOff) * maxPetalRadius * 0.5;
                    const endY = -Math.cos(angleOff) * maxPetalRadius * 0.5;
                    ctx.quadraticCurveTo(endX * 0.5, endY * 0.4, endX, endY);
                    ctx.stroke();
                }
                ctx.restore();
            }
            
            ctx.restore();
        });
        
        // Gold Center
        ctx.save();
        let centerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, maxPetalRadius * 0.15);
        centerGlow.addColorStop(0, '#ffffff');
        centerGlow.addColorStop(0.4, '#ffd700');
        centerGlow.addColorStop(0.8, 'rgba(255, 215, 0, 0.4)');
        centerGlow.addColorStop(1.0, 'transparent');
        ctx.fillStyle = centerGlow;
        ctx.beginPath();
        ctx.arc(0, 0, maxPetalRadius * 0.15, 0, Math.PI*2);
        ctx.fill();
        
        if (Math.random() < 0.05) {
            particles.push(new PollenParticle(startX + (Math.random() - 0.5) * 10, targetY + (Math.random() - 0.5) * 10));
        }
        ctx.restore();
        ctx.restore();
        
        // Draw active pollen particles
        particles = particles.filter(p => {
            p.update();
            p.draw(ctx);
            return p.alpha > 0;
        });
        
        introFlowerAnim = requestAnimationFrame(idleDrawLoop);
    }
    
    // Start the animation
    introFlowerAnim = requestAnimationFrame(draw);
}


/* ==========================================================================
   Interactive Garden Feature
   ========================================================================== */
function initInteractiveGarden() {
    const canvas = document.getElementById('garden-canvas');
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    
    function resizeGarden() {
        canvas.width = container.clientWidth * window.devicePixelRatio;
        canvas.height = container.clientHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    resizeGarden();
    window.addEventListener('resize', resizeGarden);
    
    let gardenFlowers = [];
    let gardenParticles = [];
    
    class SmallFlower {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.progress = 0;
            this.maxRadius = Math.random() * 12 + 10;
            this.growthSpeed = Math.random() * 0.015 + 0.015;
            this.stemLength = Math.random() * 20 + 20;
            this.color1 = '#3c096c';
            this.color2 = Math.random() > 0.5 ? '#8a2be2' : '#f15bb5';
        }
        update() {
            if (this.progress < 1) {
                this.progress += this.growthSpeed;
            }
        }
        draw(c) {
            const currentStemY = this.y - this.stemLength * Math.min(this.progress / 0.4, 1);
            const currentHeadY = this.y - this.stemLength;
            
            // Draw Stem
            c.beginPath();
            c.moveTo(this.x, this.y);
            c.quadraticCurveTo(this.x - 5, this.y - this.stemLength * 0.5, this.x, currentStemY);
            c.strokeStyle = '#2b5c2d';
            c.lineWidth = 2.5;
            c.stroke();
            
            // Draw Bloom
            if (this.progress > 0.4) {
                const bloomProg = (this.progress - 0.4) / 0.6;
                const r = bloomProg * this.maxRadius;
                
                c.save();
                c.translate(this.x, currentHeadY);
                c.scale(1 + Math.sin(Date.now() * 0.003 + this.x) * 0.03 * bloomProg, 1 + Math.sin(Date.now() * 0.003 + this.x) * 0.03 * bloomProg);
                
                // Draw 5 Small Petals
                for (let i = 0; i < 5; i++) {
                    c.save();
                    c.rotate((i * Math.PI * 2) / 5);
                    c.beginPath();
                    c.moveTo(0, 0);
                    c.bezierCurveTo(-r * 0.5, -r * 0.3, -r * 0.4, -r, 0, -r);
                    c.bezierCurveTo(r * 0.4, -r, r * 0.5, -r * 0.3, 0, 0);
                    c.closePath();
                    
                    let pGrad = c.createRadialGradient(0, 0, r * 0.1, 0, -r * 0.5, r);
                    pGrad.addColorStop(0, this.color1);
                    pGrad.addColorStop(0.8, this.color2);
                    pGrad.addColorStop(1.0, '#e0aaff');
                    
                    c.fillStyle = pGrad;
                    c.fill();
                    c.restore();
                }
                
                // Yellow Pistil Center
                c.fillStyle = '#ffd700';
                c.beginPath();
                c.arc(0, 0, r * 0.18, 0, Math.PI*2);
                c.fill();
                
                c.restore();
            }
        }
    }
    
    class Sparkle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = -Math.random() * 2 - 0.5;
            this.size = Math.random() * 2 + 1;
            this.alpha = 1;
            this.decay = Math.random() * 0.02 + 0.01;
            this.color = Math.random() > 0.5 ? '#ffd700' : '#d59bf6';
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.alpha -= this.decay;
        }
        draw(c) {
            c.save();
            c.globalAlpha = this.alpha;
            c.fillStyle = this.color;
            c.beginPath();
            c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
    }
    
    // Main Garden Loop
    function loop() {
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;
        
        ctx.clearRect(0, 0, w, h);
        
        // Draw soil/ground base
        let groundGrad = ctx.createLinearGradient(0, h - 35, 0, h);
        groundGrad.addColorStop(0, '#10081d');
        groundGrad.addColorStop(1, '#050309');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, h - 35, w, 35);
        ctx.strokeStyle = 'rgba(138, 43, 226, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h - 35);
        ctx.lineTo(w, h - 35);
        ctx.stroke();
        
        // Update & Draw Flowers
        gardenFlowers.forEach(f => {
            f.update();
            f.draw(ctx);
        });
        
        // Update & Draw Particles
        gardenParticles = gardenParticles.filter(p => {
            p.update();
            p.draw(ctx);
            return p.alpha > 0;
        });
        
        gardenFlowerAnim = requestAnimationFrame(loop);
    }
    gardenFlowerAnim = requestAnimationFrame(loop);
    
    // Seed a new flower on click
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Check if clicked close to soil level
        const h = canvas.height / window.devicePixelRatio;
        
        // Plant flower on clicking any zone, but set base y to soil line or click height
        let flowerY = clickY;
        if (clickY < h - 50) {
            // If they click high up, let the stem grow all the way down, or force to ground
            flowerY = Math.min(clickY + 30, h - 35);
        } else {
            flowerY = h - 35;
        }
        
        // Add new flower
        gardenFlowers.push(new SmallFlower(clickX, flowerY));
        
        // Create sparkles
        for (let i = 0; i < 12; i++) {
            gardenParticles.push(new Sparkle(clickX, flowerY - 15));
        }
        
        // Play synthesized sweet bell sound!
        // Select frequency based on relative X position
        const keyNotes = Object.keys(NOTE_FREQS);
        const noteIdx = Math.floor((clickX / rect.width) * keyNotes.length);
        const activeNote = keyNotes[Math.max(0, Math.min(noteIdx, keyNotes.length - 1))];
        playSynthNote(NOTE_FREQS[activeNote], 'sine', 1.2);
    });
}


/* ==========================================================================
   Page Interactions & Event Listeners
   ========================================================================== */
function setupEventListeners() {
    // 1. Audio Playback Toggle (Floating button)
    const audioToggle = document.getElementById('audio-toggle');
    if (audioToggle) {
        audioToggle.addEventListener('click', togglePlayback);
    }
    
    // 2. Discover Button (transitions from Intro Screen to Main Screen)
    const enterBtn = document.getElementById('enter-btn');
    const introScreen = document.getElementById('intro-screen');
    const mainScreen = document.getElementById('main-screen');
    
    if (enterBtn) {
        enterBtn.addEventListener('click', () => {
            // Stop intro flower animation loop to save resources
            if (introFlowerAnim) {
                cancelAnimationFrame(introFlowerAnim);
            }
            
            // Transition screens
            introScreen.classList.remove('active');
            introScreen.classList.add('hidden');
            
            mainScreen.classList.remove('hidden');
            mainScreen.classList.add('active');
            
            // Initialize interactive garden canvas loop
            initInteractiveGarden();
            
            // Setup & initialize visualizer canvas size and playlist items
            resizeVisualizerCanvas();
            window.addEventListener('resize', resizeVisualizerCanvas);
            updateActiveTrackUI();
            
            // Automatically play background medley upon entering
            setTimeout(() => {
                if (!isPlaying) {
                    togglePlayback();
                }
            }, 600);
            
            // Trigger subtle synth cascade to celebrate transition
            playTransitionArpeggio();
        });
    }
    
    // 3. Medley Player Buttons & Seek Bar
    const playBtn = document.getElementById('player-play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', togglePlayback);
    }
    
    const prevBtn = document.getElementById('player-prev-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => selectTrack(currentTrackIndex - 1));
    }
    
    const nextBtn = document.getElementById('player-next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => selectTrack(currentTrackIndex + 1));
    }
    
    const playlistTracks = document.querySelectorAll('.playlist-track');
    playlistTracks.forEach(track => {
        track.addEventListener('click', () => {
            const idx = parseInt(track.getAttribute('data-index'), 10);
            selectTrack(idx);
        });
    });
    
    const progressContainer = document.getElementById('player-progress-container');
    if (progressContainer) {
        progressContainer.addEventListener('click', (e) => {
            if (!currentAudio) return;
            const rect = progressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percent = clickX / rect.width;
            
            const duration = currentAudio.duration || 0;
            currentAudio.currentTime = percent * duration;
            updateProgressBar();
        });
    }
    
    // 4. Envelope opening and Letter Modal logic
    const envelope = document.getElementById('envelope');
    const letter = document.getElementById('letter');
    const letterModal = document.getElementById('letter-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    
    if (envelope) {
        envelope.addEventListener('click', (e) => {
            envelope.classList.toggle('open');
            e.stopPropagation();
            
            // Sound effect
            if (envelope.classList.contains('open')) {
                playSynthNote(NOTE_FREQS['E4'], 'sine', 1.0);
                setTimeout(() => playSynthNote(NOTE_FREQS['G4'], 'sine', 1.0), 150);
                setTimeout(() => playSynthNote(NOTE_FREQS['C5'], 'triangle', 1.5), 300);
            } else {
                playSynthNote(NOTE_FREQS['G4'], 'sine', 0.8);
                setTimeout(() => playSynthNote(NOTE_FREQS['D4'], 'sine', 0.8), 120);
            }
        });
    }
    
    if (letter && letterModal) {
        letter.addEventListener('click', (e) => {
            e.stopPropagation();
            if (envelope && envelope.classList.contains('open')) {
                letterModal.classList.remove('hidden');
                setTimeout(() => {
                    letterModal.classList.add('active');
                }, 10);
                playSynthNote(659.25, 'sine', 1.0); // play E5
            }
        });
    }
    
    if (modalCloseBtn && letterModal) {
        const closeModal = () => {
            letterModal.classList.remove('active');
            setTimeout(() => {
                letterModal.classList.add('hidden');
            }, 500);
            playSynthNote(NOTE_FREQS['G4'], 'sine', 0.8);
        };
        
        modalCloseBtn.addEventListener('click', closeModal);
        
        letterModal.addEventListener('click', (e) => {
            if (e.target === letterModal) {
                closeModal();
            }
        });
    }
    
    // 6. Mouse position tracking for card glow effect
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// Sparkle cascade arpeggio on screen transitions
function playTransitionArpeggio() {
    const arpeggio = ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'];
    arpeggio.forEach((note, idx) => {
        setTimeout(() => {
            // Synthesize higher, sparkly notes
            const freq = NOTE_FREQS[note] || (NOTE_FREQS[note.replace('5', '4')] * 2);
            playSynthNote(freq, 'sine', 1.5);
        }, idx * 100);
    });
}
