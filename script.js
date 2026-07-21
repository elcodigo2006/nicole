document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================================
    // 1. MENÚ DESPLEGABLE MÓVIL
    // ==========================================================================
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');

    if (menuToggle && navMenu) {
        // Abrir y cerrar menú al pulsar el botón de tres rayas
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('open');
        });

        // Cerrar el menú automáticamente al hacer clic en cualquier enlace
        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('open');
            });
        });

        // Cerrar el menú si se hace clic fuera de él
        document.addEventListener('click', (e) => {
            if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                navMenu.classList.remove('open');
            }
        });
    }

    // ==========================================================================
    // 2. CAMBIO DE PESTAÑAS EN LA CARTA (Desayunos, Especialidades, Bebidas)
    // ==========================================================================
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = button.getAttribute('data-target');

            // Desactivar todos los botones y ocultar todos los contenidos
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activar solo el botón pulsado y su contenido
            button.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // ==========================================================================
    // 3. COMPROBADOR DE ESTADO EN VIVO (Abierto / Cerrado)
    // ==========================================================================
    const statusPulse = document.getElementById('statusPulse');
    const statusLabel = document.getElementById('statusLabel');
    const statusTimeDetail = document.getElementById('statusTimeDetail');

    // Horarios configurados en minutos desde las 00:00 (Ej: 9:00 = 540 min)
    const scheduleRules = {
        1: null,                             // Lunes: Cerrado
        2: { start: 540, end: 1320 },         // Martes: 09:00 - 22:00
        3: { start: 540, end: 1320 },         // Miércoles: 09:00 - 22:00
        4: { start: 540, end: 1380 },         // Jueves: 09:00 - 23:00
        5: { start: 540, end: 1350 },         // Viernes: 09:00 - 22:30
        6: { start: 540, end: 1350 },         // Sábado: 09:00 - 22:30
        0: { start: 540, end: 1350 }          // Domingo: 09:00 - 22:30
    };

    function updateLiveStatus() {
        const now = new Date();
        const currentDay = now.getDay(); // 0 (Domingo) a 6 (Sábado)
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Resaltar la tarjeta del día actual
        document.querySelectorAll('.day-card').forEach(card => card.classList.remove('active-day'));
        const todayCard = document.getElementById(`day-${currentDay}`);
        if (todayCard) {
            todayCard.classList.add('active-day');
        }

        const todayRule = scheduleRules[currentDay];

        if (!todayRule) {
            // Lunes o días cerrados
            setClosedState("Hoy lunes cerramos por descanso.");
        } else if (currentMinutes >= todayRule.start && currentMinutes < todayRule.end) {
            // Horario de apertura
            const endHour = Math.floor(todayRule.end / 60);
            const endMin = todayRule.end % 60 === 0 ? "00" : "30";
            setOpenState(`¡Abierto ahora! Hoy cerramos a las ${endHour}:${endMin}.`);
        } else {
            // Fuera de horario
            if (currentMinutes < todayRule.start) {
                const startHour = Math.floor(todayRule.start / 60);
                setClosedState(`Cerrado. Hoy abrimos a las 0${startHour}:00.`);
            } else {
                setClosedState(`Cerrado actualmente.`);
            }
        }
    }

    function setOpenState(message) {
        if (statusPulse && statusLabel && statusTimeDetail) {
            statusPulse.className = 'pulse-indicator open';
            statusLabel.textContent = 'Abierto';
            statusLabel.style.color = 'var(--color-success)';
            statusTimeDetail.textContent = message;
        }
    }

    function setClosedState(message) {
        if (statusPulse && statusLabel && statusTimeDetail) {
            statusPulse.className = 'pulse-indicator closed';
            statusLabel.textContent = 'Cerrado';
            statusLabel.style.color = 'var(--color-danger)';
            statusTimeDetail.textContent = message;
        }
    }

    // Ejecutar al cargar la página y recalcular cada minuto
    updateLiveStatus();
    setInterval(updateLiveStatus, 60000);
});
