let state = {
    'S1': { step: 0, max: typeof S1_TL !== 'undefined' ? S1_TL.length - 1 : 0, data: typeof S1_TL !== 'undefined' ? S1_TL : [], playing: false },
    'S2': { step: 0, max: typeof S2_TL !== 'undefined' ? S2_TL.length - 1 : 0, data: typeof S2_TL !== 'undefined' ? S2_TL : [], playing: false }
};
let velocity = 0.8; 
let globalPausedServers = [];
let lastActiveServer = 'S1'; 
let isMaximized = false;

function getRelativePos(el, parent) {
    let top = 0, left = 0;
    while (el && el !== parent) {
        top += el.offsetTop;
        left += el.offsetLeft;
        el = el.offsetParent;
    }
    return { top, left };
}

function toggleMaximize() {
    if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
        else if (document.documentElement.msRequestFullscreen) document.documentElement.msRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }
}

document.addEventListener('fullscreenchange', () => {
    const wrapper = document.getElementById('raft-wrapper');
    const btn = document.getElementById('btn-maximize');
    if (document.fullscreenElement) {
        isMaximized = true; wrapper.classList.add('maximized');
        btn.innerHTML = "🔳 Minimizar"; document.body.style.overflow = "hidden";
    } else {
        isMaximized = false; wrapper.classList.remove('maximized');
        btn.innerHTML = "🔲 Pantalla Completa"; document.body.style.overflow = "auto";
    }
    setTimeout(() => { renderFollower('S1'); renderFollower('S2'); }, 300);
});

document.addEventListener('webkitfullscreenchange', () => { document.dispatchEvent(new Event('fullscreenchange')); });

function updateS3Highlights() {
    const activeState = state[lastActiveServer];
    const frame = activeState.data[activeState.step];
    const prevTarget = frame.tp;
    const entryTargets = frame.te || [];

    for (let i = 10; i <= 13; i++) {
        const s3Cell = document.getElementById(`c-S3-${i}`);
        if (s3Cell) {
            s3Cell.classList.remove('prev-index-marker');
            if (prevTarget === i) s3Cell.classList.add('prev-index-marker');
        }
    }

    let boundingBox = document.getElementById('entries-box-global');
    if (!boundingBox) {
        boundingBox = document.createElement('div');
        boundingBox.id = 'entries-box-global';
        boundingBox.className = 'entries-bounding-box';
        document.getElementById('dashboard').appendChild(boundingBox);
    }

    if (entryTargets.length > 0) { 
        const firstCell = document.getElementById(`c-S3-${entryTargets[0]}`);
        const lastCell = document.getElementById(`c-S3-${entryTargets[entryTargets.length - 1]}`);
        const dashRect = document.getElementById('dashboard');

        if (firstCell && lastCell) {
            const firstPos = getRelativePos(firstCell, dashRect);
            const lastPos = getRelativePos(lastCell, dashRect);
            const offset = 10; 

            const left = firstPos.left - offset;
            const top = firstPos.top - offset;
            const width = (lastPos.left + lastCell.offsetWidth) - firstPos.left + (offset * 2);
            const height = firstCell.offsetHeight + (offset * 2);

            boundingBox.style.top = `${top}px`;
            boundingBox.style.left = `${left}px`;
            boundingBox.style.width = `${width}px`;
            boundingBox.style.height = `${height}px`;
            boundingBox.style.opacity = '1';
            boundingBox.innerHTML = '<span class="entries-box-label">ENTRIES</span>';
        }
    } else {
        boundingBox.style.opacity = '0';
    }
}

function renderFollower(server) {
    const current = state[server];
    const frame = current.data[current.step];
    
    document.getElementById(`desc-${server}`).innerHTML = frame.d || "";
    document.getElementById(`ni-${server}`).innerText = frame.ni;
    document.getElementById(`scrubber-${server}`).value = current.step;
    document.getElementById(`eval-${server}`).innerHTML = frame.e || ""; 
    document.getElementById(`btn-prev-${server}`).disabled = (current.step === 0);
    document.getElementById(`btn-next-${server}`).disabled = (current.step === current.max);

    for (let i = 0; i < 4; i++) {
        const actualIdx = i + 10;
        const fCell = document.getElementById(`c-${server}-${actualIdx}`);
        fCell.className = 'cell'; 
        
        if (frame.l[i] !== undefined && String(frame.l[i]).includes('SNAPSHOT')) {
            fCell.innerHTML = frame.l[i]; fCell.classList.add('snap-cell');
        } else if (frame.l[i] !== undefined) {
            fCell.innerHTML = frame.l[i]; fCell.classList.add('has-data');
        } else {
            fCell.innerHTML = '-'; fCell.classList.add('empty-cell');
        }
        
        if (frame.h === actualIdx) fCell.classList.add('highlight');
        if (frame.del === actualIdx) fCell.classList.add('vanish');
    }

    if (frame.l3) {
        for (let i = 0; i < 4; i++) {
            const actualIdx = i + 10;
            const s3Cell = document.getElementById(`c-S3-${actualIdx}`);
            if (s3Cell) {
                s3Cell.className = 'cell'; 
                if (frame.l3[i] !== undefined && String(frame.l3[i]).includes('SNAPSHOT')) {
                    s3Cell.innerHTML = frame.l3[i]; s3Cell.classList.add('snap-cell');
                } else if (frame.l3[i] !== undefined) {
                    s3Cell.innerHTML = frame.l3[i]; s3Cell.classList.add('has-data');
                } else {
                    s3Cell.innerHTML = '-'; s3Cell.classList.add('empty-cell');
                }
                if (frame.h3 === actualIdx) s3Cell.classList.add('highlight');
                if (frame.cInsert === actualIdx) s3Cell.classList.add('client-insert'); 
            }
        }
    }

    if (server === lastActiveServer) {
        updateS3Highlights();
        document.getElementById('eval-S3').innerHTML = frame.e3 || "";
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

        const dashRect = document.getElementById('dashboard');
        const rowLabel = document.getElementById(`label-${frame.pkt.loc}`);
        const colHeader = document.getElementById(`hdr-rpc-${server}`);

        const rowPos = getRelativePos(rowLabel, dashRect);
        const colPos = getRelativePos(colHeader, dashRect);

        const colCenterX = colPos.left + (colHeader.offsetWidth / 2);
        const rowCenterY = rowPos.top + (rowLabel.offsetHeight / 2);

        packetEl.style.top = `${rowCenterY}px`;
        packetEl.style.left = `${colCenterX}px`; 
    }
}

// --- NUEVA LÓGICA: Exclusividad de la línea de tiempo ---
function resetOther(currentServer) {
    const other = currentServer === 'S1' ? 'S2' : 'S1';
    // Si el otro servidor tiene algún progreso, reiniciarlo silenciosamente
    if (state[other].step !== 0 || state[other].playing) {
        state[other].playing = false;
        state[other].step = 0;
        
        const btn = document.getElementById(`btn-play-${other}`);
        if (btn) {
            btn.innerHTML = "▶ Auto-Play Sync";
            btn.classList.remove('danger'); 
            btn.classList.add('primary');
        }
        renderFollower(other);
    }
}

document.addEventListener('click', (e) => {
    if (e.target.closest('button, input, .play-controls, .velocity-bar, .flying-packet')) return;
    const s1Playing = state['S1'].playing; const s2Playing = state['S2'].playing;
    
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
        if (!resumedAny && state[lastActiveServer].step < state[lastActiveServer].max) togglePlay(lastActiveServer);
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
    lastActiveServer = server; const btn = document.getElementById(`btn-play-${server}`);
    if (state[server].playing) {
        state[server].playing = false; btn.innerHTML = "▶ Auto-Play Sync";
        btn.classList.remove('danger'); btn.classList.add('primary');
    } else {
        resetOther(server); // Resetear el otro antes de comenzar
        if (state[server].step >= state[server].max) { state[server].step = 0; renderFollower(server); }
        state[server].playing = true; btn.innerHTML = "⏸ Pause Sync";
        btn.classList.remove('primary'); btn.classList.add('danger');

        while (state[server].playing && state[server].step < state[server].max) {
            await sleep(1500 / velocity);
            if (!state[server].playing) break; 
            state[server].step++; renderFollower(server);
        }
        state[server].playing = false; btn.innerHTML = "▶ Auto-Play Sync";
        btn.classList.remove('danger'); btn.classList.add('primary');
    }
}

function step(server, direction) {
    lastActiveServer = server; 
    resetOther(server); // Resetear el otro antes de avanzar
    
    if (state[server].playing) togglePlay(server); 
    let newStep = state[server].step + direction;
    if (newStep >= 0 && newStep <= state[server].max) {
        state[server].step = newStep; renderFollower(server);
    }
}

document.getElementById('scrubber-S1').addEventListener('input', (e) => {
    lastActiveServer = 'S1'; 
    resetOther('S1'); // Resetear el otro al mover la barra
    if (state['S1'].playing) togglePlay('S1');
    state['S1'].step = parseInt(e.target.value); renderFollower('S1');
});

document.getElementById('scrubber-S2').addEventListener('input', (e) => {
    lastActiveServer = 'S2'; 
    resetOther('S2'); // Resetear el otro al mover la barra
    if (state['S2'].playing) togglePlay('S2');
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

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; 

    if (e.key === 'ArrowRight') {
        step(lastActiveServer, 1);
        e.preventDefault(); // Evita scroll de la página
    } else if (e.key === 'ArrowLeft') {
        step(lastActiveServer, -1);
        e.preventDefault(); // Evita scroll de la página
    }
});