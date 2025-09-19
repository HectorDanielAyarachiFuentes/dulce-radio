document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN Y CONSTANTES ---
    const STREAM_URL = "https://stream.zeno.fm/my313e532yzuv";
    const INITIAL_VOLUME = 0.75;

    const STATUS_MESSAGES = {
        loading: { text: 'Cargando...', icon: 'fa-info-circle' },
        ready: { text: 'Listo. ¡Haz clic en <strong>Play</strong>!', icon: 'fa-play-circle' },
        playing: { text: 'Reproduciendo...', icon: 'fa-volume-up' },
        paused: { text: 'Pausado', icon: 'fa-volume-mute' },
        stopped: { text: 'Detenido', icon: 'fa-stop-circle' },
        buffering: { text: 'Cargando buffer... <i class="fas fa-spinner fa-spin"></i>', icon: 'fa-hourglass-half' },
        ended: { text: 'Transmisión finalizada o interrumpida.', icon: 'fa-info-circle' },
        error: { text: 'Error al reproducir. Intenta de nuevo.', icon: 'fa-exclamation-triangle' },
        autoplayBlocked: { text: '¡Haz clic en <strong>Play</strong> para escuchar!', icon: 'fa-play-circle' }
    };

    // --- SELECCIÓN DE ELEMENTOS DEL DOM ---
    const player = document.getElementById('player');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const muteBtn = document.getElementById('muteBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const statusText = document.querySelector('.status-display .text');
    const statusIcon = document.querySelector('.status-display .icon');
    const volumeSize = document.querySelector('.vol-size');
    const equalizerBars = document.querySelectorAll('.equalizer .eq-bar');
    const musicCircle = document.querySelector('.music-circle');
    const sparkleContainer = musicCircle.querySelector('.sparkle-container');
    const volumeIcon = muteBtn.querySelector('i');

    // --- ESTADO DE LA APLICACIÓN ---
    let isPlaying = false;
    let lastVolume = INITIAL_VOLUME;
    let sparkleInterval = null;

    // --- FUNCIONES ---

    /**
     * Actualiza el texto y el icono del display de estado.
     * @param {object} status - El objeto de estado de STATUS_MESSAGES.
     * @param {string} [customText] - Texto personalizado para sobrescribir el del estado.
     */
    function updateStatus(status, customText = '') {
        statusText.innerHTML = customText || status.text;
        statusIcon.innerHTML = `<i class="fas ${status.icon}"></i>`;
    }

    /**
     * Actualiza el ícono y el estado ARIA del botón de play/pausa.
     * @param {boolean} playing - El estado actual de reproducción.
     */
    function updatePlayPauseIcon(playing) {
        const icon = playPauseBtn.querySelector('i');
        if (playing) {
            icon.classList.replace('fa-play', 'fa-pause');
            playPauseBtn.setAttribute('aria-label', 'Pausar');
            playPauseBtn.classList.replace('btn-success', 'btn-danger');
        } else {
            icon.classList.replace('fa-pause', 'fa-play');
            playPauseBtn.setAttribute('aria-label', 'Reproducir');
            playPauseBtn.classList.replace('btn-danger', 'btn-success');
        }
    }

    /**
     * Actualiza el volumen, el texto, el ícono y el estilo del slider.
     * @param {number} value - El valor del volumen (0-100).
     */
    function updateVolume(value) {
        const volume = value / 100;
        volumeSize.textContent = `${value}%`;
        player.volume = volume;
        volumeSlider.style.setProperty('--volume-progress', `${value}%`);

        if (volume === 0) {
            volumeIcon.className = 'fas fa-volume-mute';
        } else if (volume < 0.5) {
            volumeIcon.className = 'fas fa-volume-down';
        } else {
            volumeIcon.className = 'fas fa-volume-up';
        }

        if (volume > 0) {
            lastVolume = volume;
        }
    }

    /** Silencia o restaura el volumen del reproductor. */
    function toggleMute() {
        const newVolume = player.volume > 0 ? 0 : lastVolume * 100;
        volumeSlider.value = newVolume;
        updateVolume(newVolume);
    }

    /**
     * Crea un efecto de destello (sparkle) en el visualizador.
     */
    function createSparkle() {
        if (!sparkleContainer || !musicCircle.classList.contains('playing')) return;

        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';

        const angle = Math.random() * Math.PI * 2;
        const circleRadius = musicCircle.offsetWidth / 2;
        
        const startRadius = circleRadius * 0.4 * (0.8 + Math.random() * 0.2);
        const endRadius = circleRadius * (0.95 + Math.random() * 0.2);

        const startX = Math.cos(angle) * startRadius;
        const startY = Math.sin(angle) * startRadius;
        const endX = Math.cos(angle) * endRadius;
        const endY = Math.sin(angle) * endRadius;

        sparkle.style.setProperty('--sparkle-start-x', `${startX}px`);
        sparkle.style.setProperty('--sparkle-start-y', `${startY}px`);
        sparkle.style.setProperty('--sparkle-end-x', `${endX}px`);
        sparkle.style.setProperty('--sparkle-end-y', `${endY}px`);
        
        const sparkleWidth = parseFloat(getComputedStyle(sparkle).width) || 4;
        sparkle.style.left = `calc(50% - ${sparkleWidth / 2}px)`;
        sparkle.style.top = `calc(50% - ${sparkleWidth / 2}px)`;

        const duration = 1.5 + Math.random() * 1.5;
        sparkle.style.animation = `sparkle-animation ${duration}s ease-out forwards`;

        sparkleContainer.appendChild(sparkle);

        setTimeout(() => sparkle.remove(), duration * 1000);
    }

    /**
     * Activa o desactiva las animaciones visuales (ecualizador, círculo, destellos).
     * @param {boolean} show - True para activar, false para desactivar.
     */
    function toggleVisuals(show) {
        equalizerBars.forEach(bar => bar.style.animationPlayState = show ? 'running' : 'paused');
        musicCircle.classList.toggle('playing', show);

        if (show) {
            if (!sparkleInterval) {
                const sparkleFrequency = window.innerWidth < 768 ? 400 : 250;
                sparkleInterval = setInterval(createSparkle, sparkleFrequency);
            }
        } else {
            if (sparkleInterval) {
                clearInterval(sparkleInterval);
                sparkleInterval = null;
            }
            sparkleContainer.innerHTML = '';
        }
    }

    // --- LÓGICA DEL REPRODUCTOR ---

    async function playStream() {
        if (isPlaying) return;

        try {
            updateStatus(STATUS_MESSAGES.buffering);
            if (player.src !== STREAM_URL) {
                player.src = STREAM_URL;
                player.load();
            }
            await player.play();
            // El estado 'isPlaying' y los visuales se activan en el evento 'playing'
        } catch (error) {
            console.error("Error al intentar reproducir:", error);
            isPlaying = false;
            toggleVisuals(false);
            if (error.name === "NotAllowedError") {
                updateStatus(STATUS_MESSAGES.autoplayBlocked);
            } else {
                updateStatus(STATUS_MESSAGES.error);
            }
        }
    }

    function pauseStream() {
        if (!isPlaying) return;
        player.pause();
        // El estado 'isPlaying' y los visuales se desactivan en el evento 'pause'
    }

    function stopStream() {
        player.pause();
        player.src = ''; // Forma correcta de detener y liberar recursos
        player.load(); // Importante para aplicar el cambio de src
        isPlaying = false;
        updateStatus(STATUS_MESSAGES.stopped);
        updatePlayPauseIcon(false);
        toggleVisuals(false);
    }

    // --- EVENT LISTENERS ---

    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            pauseStream();
        } else {
            playStream();
        }
    });
    stopBtn.addEventListener('click', stopStream);
    muteBtn.addEventListener('click', toggleMute);

    volumeSlider.addEventListener('input', function () {
        updateVolume(this.value);
    });

    // Eventos del elemento <audio>
    player.addEventListener('playing', () => {
        isPlaying = true;
        updateStatus(STATUS_MESSAGES.playing);
        toggleVisuals(true);
        updatePlayPauseIcon(true);
    });

    player.addEventListener('pause', () => {
        isPlaying = false;
        // Solo actualiza a 'pausado' si no se detuvo completamente
        if (player.src) {
            updateStatus(STATUS_MESSAGES.paused);
        }
        toggleVisuals(false);
        updatePlayPauseIcon(false);
    });

    player.addEventListener('waiting', () => updateStatus(STATUS_MESSAGES.buffering));
    player.addEventListener('ended', () => updateStatus(STATUS_MESSAGES.ended));

    player.addEventListener('error', (e) => {
        console.error('Error en el stream de audio:', e);
        let errorMessage = STATUS_MESSAGES.error.text;
        if (player.error) {
            switch (player.error.code) {
                case MediaError.MEDIA_ERR_NETWORK: errorMessage = 'Error de red. Revisa tu conexión.'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMessage = 'Formato de audio no soportado.'; break;
            }
        }
        updateStatus(STATUS_MESSAGES.error, errorMessage);
        toggleVisuals(false);
        isPlaying = false;
    });

    // --- INICIALIZACIÓN ---
    function init() {
        updateStatus(STATUS_MESSAGES.loading);
        updateVolume(INITIAL_VOLUME * 100);
        toggleVisuals(false);
        updatePlayPauseIcon(false);
        updateStatus(STATUS_MESSAGES.ready);
    }

    init();
});