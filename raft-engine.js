let state = {
    'S1': { step: 0, max: typeof S1_TL !== 'undefined' ? S1_TL.length - 1 : 0, data: typeof S1_TL !== 'undefined' ? S1_TL : [], playing: false },
    'S2': { step: 0, max: typeof S2_TL !== 'undefined' ? S2_TL.length - 1 : 0, data: typeof S2_TL !== 'undefined' ? S2_TL : [], playing: false }
};
let velocity = 0.8; 
let globalPausedServers = [];
let lastActiveServer = 'S1'; 
let isMaximized = false;

// --- NUEVA LÓGICA FULLSCREEN ---
function toggleMaximize() {
    if (!document.fullscreenElement) {
        // Pedir pantalla completa al navegador
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { /* IE11 */
            document.documentElement.msRequestFullscreen();
        }
    } else {
        // Salir de pantalla completa
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
        }
    }
}

// Escuchar cambios de estado (Maneja el click en el botón Y la tecla ESC)
document.addEventListener('fullscreenchange', () => {
    const wrapper = document.getElementById('raft-wrapper');
    const btn = document.getElementById('btn-maximize');
    
    if (document.fullscreenElement) {
        isMaximized = true;
        wrapper.classList.add('maximized');
        btn.innerHTML = "🔳 Minimizar";
        document.body.style.overflow = "hidden";
    } else {
        isMaximized = false;
        wrapper.classList.remove('maximized');
        btn.innerHTML = "🔲 Pantalla Completa";
        document.body.style.overflow = "auto";
    }
    
    // Recalcular posiciones de los paquetes tras el cambio de layout
    setTimeout(() => { renderFollower('S1'); renderFollower('S2'); }, 300);
});

// Safari vendor prefix support
document.addEventListener('webkitfullscreenchange', () => {
    document.dispatchEvent(new Event('fullscreenchange'));
});

function renderFollower(server) {
    const current = state[server];
    const frame = current.data[current.step];
    
    document.getElementById(`desc-${server}`).innerHTML = frame.d || "";
    document.getElementById(`ni-${server}`).innerText = frame.ni;
    document.getElementById(`scrubber-${server}`).value = current.step;
    document.getElementById(`eval-${server}`).innerHTML = frame.e || ""; 
    document.getElementById(`btn-prev-${server}`).disabled = (current.step === 0);
    document.getElementById(`btn-next-${server}`).disabled = (current.step === current.max);

    let prevTarget = frame.tp;
    let entryTargets = frame.te || [];

    for (let i = 0; i < 4; i++) {
        const actualIdx = i + 10;
        const fCell = document.getElementById(`c-${server}-${actualIdx}`);
        fCell.className = 'cell'; 
        
        // BUG FIX: Safely cast to String before calling .includes() to prevent Number type errors
        if (frame.l[i] !== undefined && String(frame.l[i]).includes('SNAPSHOT')) {
            fCell.innerHTML = frame.l[i]; 
            fCell.classList.add('snap-cell');
        } else if (frame.l[i] !== undefined) {
            fCell.innerHTML = frame.l[i]; 
            fCell.classList.add('has-data');
        } else {
            fCell.innerHTML = '-'; 
            fCell.classList.add('empty-cell');
        }
        
        if (frame.h === actualIdx) fCell.classList.add('highlight');
        if (frame.del === actualIdx) fCell.classList.add('vanish');

        const s3Cell = document.getElementById(`c-S3-${actualIdx}`);
        if(s3Cell) {
            s3Cell.classList.remove('prev-index-marker', 'entry-marker');
            if (prevTarget === actualIdx) s3Cell.classList.add('prev-index-marker');
            else if (entryTargets.includes(actualIdx)) s3Cell.classList.add('entry-marker');
        }
    }

    const packetEl = document.getElementById(`packet-${server}`);
    if (!frame.pkt) {
        packetEl.style.opacity = '0';
        packetEl.style.pointerEvents = 'none';
    } else {
        packetEl.innerHTML = frame.pkt.txt;
        packetEl.className = `flying-packet ${frame.pkt.type}`;
        packetEl.style.opacity = '1';
        packetEl.style.pointerEvents = 'auto';

        const dashRect = document.getElementById('dashboard').getBoundingClientRect();
        const rowLabelRect = document.getElementById(`label-${frame.pkt.loc}`).getBoundingClientRect();
        const colRect = document.getElementById(`hdr-rpc-${server}`).getBoundingClientRect();

        const colCenterX = colRect.left - dashRect.left + (colRect.width / 2);
        const rowCenterY = rowLabelRect.top - dashRect.top + (rowLabelRect.height / 2);

        packetEl.style.top = `${rowCenterY}px`;
        packetEl.style.left = `${colCenterX}px`; 
    }
}

document.addEventListener('click', (e) => {
    if (e.target.closest('button, input, .play-controls, .velocity-bar, .flying-packet')) return;
    const s1Playing = state['S1'].playing;
    const s2Playing = state['S2'].playing;
    
    if (s1Playing || s2Playing) {
        globalPausedServers = [];
        if (s1Playing) { togglePlay('S1'); globalPausedServers.push('S1'); }
        if (s2Playing) { togglePlay('S2'); globalPausedServers.push('S2'); }
    } else {
        let resumedAny = false;
        if (globalPausedServers.length > 0) {
            globalPausedServers.forEach(s => {
                if (state[s].step < state[s].max) { togglePlay(s); resumedAny = true; }
            });
        }
        if (!resumedAny && state[lastActiveServer].step < state[lastActiveServer].max) {
            togglePlay(lastActiveServer);
        }
    }
});

document.getElementById('slider-speed').addEventListener('input', (e) => {
    velocity = parseFloat(e.target.value);
    document.getElementById('speed-val').innerText = velocity.toFixed(2) + 'x';
    const duration = (0.5 / velocity).toFixed(2);
    document.getElementById('packet-S1').style.transitionDuration = `top ${duration}s, left ${duration}s, opacity 0.2s, background-color 0.2s, border-color 0.2s, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
    document.getElementById('packet-S2').style.transitionDuration = `top ${duration}s, left ${duration}s, opacity 0.2s, background-color 0.2s, border-color 0.2s, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
});

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function togglePlay(server) {
    lastActiveServer = server;
    const btn = document.getElementById(`btn-play-${server}`);
    
    if (state[server].playing) {
        state[server].playing = false;
        btn.innerHTML = "▶ Auto-Play Sync";
        btn.classList.remove('danger'); btn.classList.add('primary');
    } else {
        if (state[server].step >= state[server].max) { state[server].step = 0; renderFollower(server); }
        state[server].playing = true;
        btn.innerHTML = "⏸ Pausar Sync";
        btn.classList.remove('primary'); btn.classList.add('danger');

        while (state[server].playing && state[server].step < state[server].max) {
            await sleep(1500 / velocity);
            if (!state[server].playing) break; 
            state[server].step++;
            renderFollower(server);
        }
        state[server].playing = false;
        btn.innerHTML = "▶ Auto-Play Sync";
        btn.classList.remove('danger'); btn.classList.add('primary');
    }
}

function step(server, direction) {
    lastActiveServer = server;
    if (state[server].playing) togglePlay(server); 
    let newStep = state[server].step + direction;
    if (newStep >= 0 && newStep <= state[server].max) {
        state[server].step = newStep; renderFollower(server);
    }
}

document.getElementById('scrubber-S1').addEventListener('input', (e) => {
    lastActiveServer = 'S1'; if (state['S1'].playing) togglePlay('S1');
    state['S1'].step = parseInt(e.target.value); renderFollower('S1');
});

document.getElementById('scrubber-S2').addEventListener('input', (e) => {
    lastActiveServer = 'S2'; if (state['S2'].playing) togglePlay('S2');
    state['S2'].step = parseInt(e.target.value); renderFollower('S2');
});

function resetBoth() {
    globalPausedServers = [];
    if (state['S1'].playing) togglePlay('S1');
    if (state['S2'].playing) togglePlay('S2');
    state['S1'].step = 0; state['S2'].step = 0;
    renderFollower('S1'); renderFollower('S2');
}

window.addEventListener('resize', () => { renderFollower('S1'); renderFollower('S2'); });
setTimeout(() => { renderFollower('S1'); renderFollower('S2'); }, 50);