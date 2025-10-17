// ========================================
// CONFIGURAÇÃO DO FIREBASE
// ========================================
// IMPORTANTE: Substitua esta configuração pela sua própria configuração do Firebase
// Obtenha em: Firebase Console > Project Settings > Your apps > Firebase SDK snippet > Config
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://SEU_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_PROJECT_ID.appspot.com",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ========================================
// VARIÁVEIS GLOBAIS
// ========================================
let currentUser = null;
let currentRoom = null;
let currentRoomId = null;
let playerCard = [];
let deckData = null;
let roomRef = null;
let playersRef = null;
let stateRef = null;
let chatRef = null;

// ========================================
// ELEMENTOS DO DOM
// ========================================
const screens = {
    landing: document.getElementById('landing-screen'),
    createRoom: document.getElementById('create-room-screen'),
    joinRoom: document.getElementById('join-room-screen'),
    game: document.getElementById('game-screen')
};

const elements = {
    // Landing
    usernameInput: document.getElementById('username'),
    createRoomBtn: document.getElementById('create-room-btn'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    
    // Create Room
    roomNameInput: document.getElementById('room-name'),
    roomPasswordInput: document.getElementById('room-password'),
    maxPlayersInput: document.getElementById('max-players'),
    deckSelect: document.getElementById('deck-select'),
    confirmCreateBtn: document.getElementById('confirm-create-btn'),
    cancelCreateBtn: document.getElementById('cancel-create-btn'),
    
    // Join Room
    joinRoomIdInput: document.getElementById('join-room-id'),
    joinRoomPasswordInput: document.getElementById('join-room-password'),
    confirmJoinBtn: document.getElementById('confirm-join-btn'),
    cancelJoinBtn: document.getElementById('cancel-join-btn'),
    
    // Game
    currentRoomName: document.getElementById('current-room-name'),
    currentPlayers: document.getElementById('current-players'),
    maxPlayersCount: document.getElementById('max-players-count'),
    copyLinkBtn: document.getElementById('copy-link-btn'),
    leaveRoomBtn: document.getElementById('leave-room-btn'),
    bingoCard: document.getElementById('bingo-card'),
    bingoBtn: document.getElementById('bingo-btn'),
    playersList: document.getElementById('players-list'),
    eventsLog: document.getElementById('events-log'),
    
    // Chat
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendMessageBtn: document.getElementById('send-message-btn'),
    
    // Modal e Toast
    notificationModal: document.getElementById('notification-modal'),
    notificationMessage: document.getElementById('notification-message'),
    closeNotificationBtn: document.getElementById('close-notification-btn'),
    toast: document.getElementById('toast')
};

// ========================================
// CARREGAR DECK
// ========================================
async function loadDeck(deckName) {
    try {
        const response = await fetch(`decks/${deckName}.json`);
        if (!response.ok) throw new Error('Deck não encontrado');
        deckData = await response.json();
        return deckData;
    } catch (error) {
        showToast('Erro ao carregar deck: ' + error.message, 'error');
        return null;
    }
}

// ========================================
// NAVEGAÇÃO ENTRE TELAS
// ========================================
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// ========================================
// FUNÇÕES DE UI - TOAST E MODAL
// ========================================
function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = 'toast show ' + type;
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

function showModal(message) {
    elements.notificationMessage.textContent = message;
    elements.notificationModal.classList.add('active');
}

function hideModal() {
    elements.notificationModal.classList.remove('active');
}

// ========================================
// VALIDAÇÕES
// ========================================
function validateUsername(username) {
    if (!username || username.trim() === '') {
        showToast('Por favor, digite seu nome', 'error');
        return false;
    }
    return true;
}

function validateRoomName(roomName) {
    if (!roomName || roomName.trim() === '') {
        showToast('Por favor, digite o nome da sala', 'error');
        return false;
    }
    return true;
}

// ========================================
// CRIAR SALA
// ========================================
async function createRoom() {
    const username = elements.usernameInput.value.trim();
    const roomName = elements.roomNameInput.value.trim();
    const password = elements.roomPasswordInput.value;
    const maxPlayers = parseInt(elements.maxPlayersInput.value);
    const deck = elements.deckSelect.value;
    
    if (!validateUsername(username) || !validateRoomName(roomName)) return;
    
    if (maxPlayers < 2 || maxPlayers > 20) {
        showToast('Número de jogadores deve ser entre 2 e 20', 'error');
        return;
    }
    
    // Carregar deck
    const deckLoaded = await loadDeck(deck);
    if (!deckLoaded) return;
    
    currentUser = username;
    
    // Criar sala no Firebase
    const newRoomRef = database.ref('rooms').push();
    currentRoomId = newRoomRef.key;
    
    const roomData = {
        name: roomName,
        hasPassword: password !== '',
        passwordHash: password ? simpleHash(password) : null,
        maxPlayers: maxPlayers,
        deck: deck,
        createdAt: Date.now(),
        started: false
    };
    
    try {
        await newRoomRef.set(roomData);
        await joinRoomById(currentRoomId, password, true);
    } catch (error) {
        showToast('Erro ao criar sala: ' + error.message, 'error');
    }
}

// ========================================
// ENTRAR EM SALA
// ========================================
async function joinRoom() {
    const username = elements.usernameInput.value.trim();
    const roomId = elements.joinRoomIdInput.value.trim();
    const password = elements.joinRoomPasswordInput.value;
    
    if (!validateUsername(username)) return;
    if (!roomId) {
        showToast('Por favor, digite o ID da sala', 'error');
        return;
    }
    
    currentUser = username;
    await joinRoomById(roomId, password, false);
}

async function joinRoomById(roomId, password, isCreator) {
    try {
        // Buscar dados da sala
        const roomSnapshot = await database.ref(`rooms/${roomId}`).once('value');
        
        if (!roomSnapshot.exists()) {
            showToast('Sala não encontrada', 'error');
            return;
        }
        
        const roomData = roomSnapshot.val();
        currentRoom = roomData;
        currentRoomId = roomId;
        
        // Verificar senha
        if (roomData.hasPassword) {
            if (!password) {
                showToast('Esta sala requer senha', 'error');
                return;
            }
            if (simpleHash(password) !== roomData.passwordHash) {
                showToast('Senha incorreta', 'error');
                return;
            }
        }
        
        // Verificar número de jogadores
        const playersSnapshot = await database.ref(`rooms/${roomId}/players`).once('value');
        const players = playersSnapshot.val() || {};
        const playerCount = Object.keys(players).length;
        
        if (playerCount >= roomData.maxPlayers) {
            showToast('Sala cheia', 'error');
            return;
        }
        
        // Verificar nome duplicado
        const usernames = Object.values(players).map(p => p.username);
        if (usernames.includes(currentUser)) {
            showToast('Nome de usuário já em uso nesta sala', 'error');
            return;
        }
        
        // Carregar deck
        const deckLoaded = await loadDeck(roomData.deck);
        if (!deckLoaded) return;
        
        // Adicionar jogador à sala
        const playerRef = database.ref(`rooms/${roomId}/players`).push();
        const playerId = playerRef.key;
        
        // Gerar cartela
        playerCard = generateCard(deckData.options, players);
        
        const playerData = {
            username: currentUser,
            joinedAt: Date.now(),
            card: playerCard,
            marks: [false, false, false, false],
            isWinner: false
        };
        
        await playerRef.set(playerData);
        
        // Configurar onDisconnect
        playerRef.onDisconnect().remove();
        
        // Configurar listeners
        setupRoomListeners(roomId, playerId);
        
        // Ir para tela de jogo
        showScreen('game');
        updateGameUI();
        renderCard();
        addEvent(`Você entrou na sala`);
        
    } catch (error) {
        showToast('Erro ao entrar na sala: ' + error.message, 'error');
    }
}

// ========================================
// GERAR CARTELA
// ========================================
function generateCard(options, existingPlayers) {
    // Embaralhar opções
    const shuffled = [...options].sort(() => Math.random() - 0.5);
    
    // Tentar gerar cartela única
    let attempts = 0;
    let card = null;
    
    while (attempts < 10) {
        card = shuffled.slice(0, 4);
        
        // Verificar se é única
        const existingCards = Object.values(existingPlayers).map(p => p.card);
        const isDuplicate = existingCards.some(existingCard => 
            JSON.stringify(existingCard.sort()) === JSON.stringify(card.sort())
        );
        
        if (!isDuplicate) break;
        
        // Tentar novamente
        shuffled.sort(() => Math.random() - 0.5);
        attempts++;
    }
    
    return card;
}

// ========================================
// RENDERIZAR CARTELA
// ========================================
function renderCard() {
    elements.bingoCard.innerHTML = '';
    
    playerCard.forEach((option, index) => {
        const square = document.createElement('div');
        square.className = 'bingo-square';
        square.textContent = option;
        square.dataset.index = index;
        
        square.addEventListener('click', () => toggleMark(index));
        
        elements.bingoCard.appendChild(square);
    });
}

// ========================================
// MARCAR/DESMARCAR QUADRADO
// ========================================
async function toggleMark(index) {
    if (!currentRoomId) return;
    
    // Buscar estado atual
    const playerSnapshot = await database.ref(`rooms/${currentRoomId}/players`)
        .orderByChild('username')
        .equalTo(currentUser)
        .once('value');
    
    if (!playerSnapshot.exists()) return;
    
    const playerId = Object.keys(playerSnapshot.val())[0];
    const playerData = playerSnapshot.val()[playerId];
    
    // Verificar se já ganhou
    if (playerData.isWinner) {
        showToast('Você já fez BINGO!', 'info');
        return;
    }
    
    // Alternar marca
    const marks = playerData.marks || [false, false, false, false];
    marks[index] = !marks[index];
    
    // Atualizar no Firebase
    await database.ref(`rooms/${currentRoomId}/players/${playerId}/marks`).set(marks);
    
    // Atualizar UI local
    updateCardUI(marks);
    
    // Verificar se completou
    checkBingo(marks, playerId);
}

function updateCardUI(marks) {
    const squares = elements.bingoCard.querySelectorAll('.bingo-square');
    squares.forEach((square, index) => {
        if (marks[index]) {
            square.classList.add('marked');
        } else {
            square.classList.remove('marked');
        }
    });
}

// ========================================
// VERIFICAR BINGO
// ========================================
function checkBingo(marks, playerId) {
    const allMarked = marks.every(mark => mark === true);
    
    if (allMarked) {
        elements.bingoBtn.style.display = 'block';
        elements.bingoBtn.onclick = () => declareBingo(playerId);
    } else {
        elements.bingoBtn.style.display = 'none';
    }
}

// ========================================
// DECLARAR BINGO
// ========================================
async function declareBingo(playerId) {
    if (!currentRoomId) return;
    
    try {
        // Verificar novamente no servidor
        const playerSnapshot = await database.ref(`rooms/${currentRoomId}/players/${playerId}`).once('value');
        const playerData = playerSnapshot.val();
        
        if (!playerData) return;
        
        const marks = playerData.marks || [false, false, false, false];
        const allMarked = marks.every(mark => mark === true);
        
        if (!allMarked) {
            showToast('Você precisa marcar todos os quadrados!', 'error');
            return;
        }
        
        // Marcar como vencedor
        await database.ref(`rooms/${currentRoomId}/players/${playerId}/isWinner`).set(true);
        
        // Registrar vitória no estado da sala
        await database.ref(`rooms/${currentRoomId}/state/winner`).set({
            playerId: playerId,
            username: currentUser,
            timestamp: Date.now()
        });
        
        // Notificar todos
        const message = `O jogador(a) ${currentUser} BINGOOOUUUUUUUU!!!!!`;
        showModal(message);
        
    } catch (error) {
        showToast('Erro ao declarar BINGO: ' + error.message, 'error');
    }
}

// ========================================
// LISTENERS DA SALA
// ========================================
function setupRoomListeners(roomId, playerId) {
    // Listener de jogadores
    playersRef = database.ref(`rooms/${roomId}/players`);
    playersRef.on('value', (snapshot) => {
        updatePlayersList(snapshot.val() || {});
        updatePlayersCount(snapshot.val() || {});
    });
    
    // Listener de estado (vencedor)
    stateRef = database.ref(`rooms/${roomId}/state/winner`);
    stateRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const winner = snapshot.val();
            const message = `O jogador(a) ${winner.username} BINGOOOUUUUUUUU!!!!!`;
            showModal(message);
            addEvent(message, true);
        }
    });
    
    // Listener de marcações do próprio jogador
    database.ref(`rooms/${roomId}/players/${playerId}/marks`).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const marks = snapshot.val();
            updateCardUI(marks);
            checkBingo(marks, playerId);
        }
    });
    
    // Listener de chat
    chatRef = database.ref(`rooms/${roomId}/chat`);
    chatRef.on('child_added', (snapshot) => {
        if (snapshot.exists()) {
            const message = snapshot.val();
            displayChatMessage(message);
        }
    });
}

// ========================================
// ATUALIZAR UI DO JOGO
// ========================================
function updateGameUI() {
    elements.currentRoomName.textContent = currentRoom.name;
    elements.maxPlayersCount.textContent = currentRoom.maxPlayers;
}

function updatePlayersList(players) {
    elements.playersList.innerHTML = '';
    
    Object.entries(players).forEach(([id, player]) => {
        const li = document.createElement('li');
        li.textContent = player.username;
        
        if (player.isWinner) {
            li.classList.add('winner');
            li.textContent += ' 🏆';
        }
        
        elements.playersList.appendChild(li);
    });
}

function updatePlayersCount(players) {
    elements.currentPlayers.textContent = Object.keys(players).length;
}

// ========================================
// LOG DE EVENTOS
// ========================================
function addEvent(message, isBingo = false) {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'event-item' + (isBingo ? ' bingo-event' : '');
    
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    eventDiv.innerHTML = `${message} <span class="event-timestamp">${time}</span>`;
    
    elements.eventsLog.insertBefore(eventDiv, elements.eventsLog.firstChild);
}

// ========================================
// CHAT
// ========================================
async function sendChatMessage() {
    const message = elements.chatInput.value.trim();
    
    if (!message || !currentRoomId || !currentUser) return;
    
    const chatMessage = {
        username: currentUser,
        text: message,
        timestamp: Date.now()
    };
    
    try {
        await database.ref(`rooms/${currentRoomId}/chat`).push(chatMessage);
        elements.chatInput.value = '';
    } catch (error) {
        showToast('Erro ao enviar mensagem: ' + error.message, 'error');
    }
}

function displayChatMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-username">${message.username}</span>
            <span class="chat-timestamp">${time}</span>
        </div>
        <div class="chat-message-text">${escapeHtml(message.text)}</div>
    `;
    
    elements.chatMessages.appendChild(messageDiv);
    
    // Auto-scroll para a última mensagem
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// COPIAR LINK DA SALA
// ========================================
function copyRoomLink() {
    const link = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
    
    navigator.clipboard.writeText(link).then(() => {
        showToast('Link copiado!', 'success');
    }).catch(() => {
        showToast('Erro ao copiar link', 'error');
    });
}

// ========================================
// SAIR DA SALA
// ========================================
async function leaveRoom() {
    if (!currentRoomId) return;
    
    try {
        // Remover jogador
        const playerSnapshot = await database.ref(`rooms/${currentRoomId}/players`)
            .orderByChild('username')
            .equalTo(currentUser)
            .once('value');
        
        if (playerSnapshot.exists()) {
            const playerId = Object.keys(playerSnapshot.val())[0];
            await database.ref(`rooms/${currentRoomId}/players/${playerId}`).remove();
        }
        
        // Limpar listeners
        if (playersRef) playersRef.off();
        if (stateRef) stateRef.off();
        if (chatRef) chatRef.off();
        
        // Resetar variáveis
        currentRoom = null;
        currentRoomId = null;
        playerCard = [];
        
        // Voltar para tela inicial
        showScreen('landing');
        showToast('Você saiu da sala', 'info');
        
    } catch (error) {
        showToast('Erro ao sair da sala: ' + error.message, 'error');
    }
}

// ========================================
// HASH SIMPLES (NÃO USAR EM PRODUÇÃO)
// ========================================
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

// ========================================
// EVENT LISTENERS
// ========================================
// Landing
elements.createRoomBtn.addEventListener('click', () => {
    if (validateUsername(elements.usernameInput.value.trim())) {
        showScreen('createRoom');
    }
});

elements.joinRoomBtn.addEventListener('click', () => {
    if (validateUsername(elements.usernameInput.value.trim())) {
        showScreen('joinRoom');
    }
});

// Create Room
elements.confirmCreateBtn.addEventListener('click', createRoom);
elements.cancelCreateBtn.addEventListener('click', () => showScreen('landing'));

// Join Room
elements.confirmJoinBtn.addEventListener('click', joinRoom);
elements.cancelJoinBtn.addEventListener('click', () => showScreen('landing'));

// Game
elements.copyLinkBtn.addEventListener('click', copyRoomLink);
elements.leaveRoomBtn.addEventListener('click', leaveRoom);

// Chat
elements.sendMessageBtn.addEventListener('click', sendChatMessage);
elements.chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

// Modal
elements.closeNotificationBtn.addEventListener('click', hideModal);

// ========================================
// INICIALIZAÇÃO
// ========================================
// Verificar se há room ID na URL
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (roomId) {
        elements.joinRoomIdInput.value = roomId;
    }
});

