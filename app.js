// Configuração do Firebase
const firebaseConfig = {
    // Substitua pelas suas configurações do Firebase
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Variáveis globais
let currentUser = null;
let currentRoom = null;
let currentRoomRef = null;
let chatRef = null;
let typingTimeout = null;

// Elementos DOM
const elements = {
    // Telas
    landingScreen: document.getElementById('landing-screen'),
    createRoomScreen: document.getElementById('create-room-screen'),
    joinRoomScreen: document.getElementById('join-room-screen'),
    gameScreen: document.getElementById('game-screen'),
    
    // Inputs
    username: document.getElementById('username'),
    roomName: document.getElementById('room-name'),
    roomPassword: document.getElementById('room-password'),
    maxPlayers: document.getElementById('max-players'),
    joinRoomId: document.getElementById('join-room-id'),
    joinRoomPassword: document.getElementById('join-room-password'),
    
    // Botões
    createRoomBtn: document.getElementById('create-room-btn'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    confirmCreateBtn: document.getElementById('confirm-create-btn'),
    cancelCreateBtn: document.getElementById('cancel-create-btn'),
    confirmJoinBtn: document.getElementById('confirm-join-btn'),
    cancelJoinBtn: document.getElementById('cancel-join-btn'),
    copyLinkBtn: document.getElementById('copy-link-btn'),
    leaveRoomBtn: document.getElementById('leave-room-btn'),
    bingoBtn: document.getElementById('bingo-btn'),
    
    // Chat
    chatInput: document.getElementById('chat-input'),
    sendMessageBtn: document.getElementById('send-message-btn'),
    chatMessages: document.getElementById('chat-messages'),
    
    // Outros elementos
    roomTitle: document.getElementById('current-room-name'),
    playersCount: document.getElementById('current-players'),
    maxPlayersCount: document.getElementById('max-players-count'),
    playersList: document.getElementById('players-list'),
    eventsLog: document.getElementById('events-log'),
    bingoCard: document.getElementById('bingo-card'),
    notificationModal: document.getElementById('notification-modal'),
    notificationMessage: document.getElementById('notification-message'),
    closeNotificationBtn: document.getElementById('close-notification-btn'),
    toast: document.getElementById('toast')
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    showScreen('landing-screen');
});

// Event Listeners
function initializeEventListeners() {
    // Navegação
    elements.createRoomBtn.addEventListener('click', () => showScreen('create-room-screen'));
    elements.joinRoomBtn.addEventListener('click', () => showScreen('join-room-screen'));
    elements.cancelCreateBtn.addEventListener('click', () => showScreen('landing-screen'));
    elements.cancelJoinBtn.addEventListener('click', () => showScreen('landing-screen'));
    
    // Criar sala
    elements.confirmCreateBtn.addEventListener('click', createRoom);
    
    // Entrar em sala
    elements.confirmJoinBtn.addEventListener('click', joinRoom);
    
    // Ações da sala
    elements.copyLinkBtn.addEventListener('click', copyRoomLink);
    elements.leaveRoomBtn.addEventListener('click', leaveRoom);
    elements.bingoBtn.addEventListener('click', claimBingo);
    
    // Chat
    elements.sendMessageBtn.addEventListener('click', sendMessage);
    elements.chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Indicador de digitação
    elements.chatInput.addEventListener('input', handleTyping);
    
    // Modal
    elements.closeNotificationBtn.addEventListener('click', () => {
        elements.notificationModal.classList.remove('active');
    });
    
    // Enter nos inputs
    elements.username.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') elements.createRoomBtn.click();
    });
    
    elements.roomName.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') elements.confirmCreateBtn.click();
    });
    
    elements.joinRoomId.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') elements.confirmJoinBtn.click();
    });
}

// Funções de navegação
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Funções de sala
function createRoom() {
    const username = elements.username.value.trim();
    const roomName = elements.roomName.value.trim();
    const roomPassword = elements.roomPassword.value.trim();
    const maxPlayers = parseInt(elements.maxPlayers.value);
    
    if (!username) {
        showNotification('Por favor, digite seu nome!');
        return;
    }
    
    if (!roomName) {
        showNotification('Por favor, digite o nome da sala!');
        return;
    }
    
    currentUser = {
        id: generateId(),
        name: username,
        isHost: true
    };
    
    const roomId = generateId();
    currentRoom = {
        id: roomId,
        name: roomName,
        password: roomPassword,
        maxPlayers: maxPlayers,
        players: [currentUser],
        host: currentUser.id,
        status: 'waiting',
        createdAt: Date.now()
    };
    
    // Salvar no Firebase
    currentRoomRef = database.ref(`rooms/${roomId}`);
    currentRoomRef.set(currentRoom);
    
    // Configurar listeners
    setupRoomListeners();
    
    // Entrar na sala
    enterRoom();
}

function joinRoom() {
    const username = elements.username.value.trim();
    const roomId = elements.joinRoomId.value.trim();
    const roomPassword = elements.joinRoomPassword.value.trim();
    
    if (!username) {
        showNotification('Por favor, digite seu nome!');
        return;
    }
    
    if (!roomId) {
        showNotification('Por favor, digite o ID da sala!');
        return;
    }
    
    // Verificar se a sala existe
    const roomRef = database.ref(`rooms/${roomId}`);
    roomRef.once('value', (snapshot) => {
        const room = snapshot.val();
        
        if (!room) {
            showNotification('Sala não encontrada!');
            return;
        }
        
        if (room.password && room.password !== roomPassword) {
            showNotification('Senha incorreta!');
            return;
        }
        
        if (room.players.length >= room.maxPlayers) {
            showNotification('Sala cheia!');
            return;
        }
        
        currentUser = {
            id: generateId(),
            name: username,
            isHost: false
        };
        
        currentRoom = room;
        currentRoomRef = roomRef;
        
        // Adicionar jogador à sala
        const updatedPlayers = [...room.players, currentUser];
        currentRoomRef.update({ players: updatedPlayers });
        
        // Configurar listeners
        setupRoomListeners();
        
        // Entrar na sala
        enterRoom();
    });
}

function enterRoom() {
    showScreen('game-screen');
    updateRoomInfo();
    setupChat();
    generateBingoCard();
}

function setupRoomListeners() {
    // Listener para mudanças na sala
    currentRoomRef.on('value', (snapshot) => {
        const room = snapshot.val();
        if (room) {
            currentRoom = room;
            updateRoomInfo();
            updatePlayersList();
        }
    });
}

function updateRoomInfo() {
    elements.roomTitle.textContent = currentRoom.name;
    elements.playersCount.textContent = currentRoom.players.length;
    elements.maxPlayersCount.textContent = currentRoom.maxPlayers;
}

function updatePlayersList() {
    elements.playersList.innerHTML = '';
    currentRoom.players.forEach(player => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${player.name}</span>
            ${player.isHost ? '<span class="host-badge">👑</span>' : ''}
        `;
        if (player.id === currentUser.id) {
            li.classList.add('current-player');
        }
        elements.playersList.appendChild(li);
    });
}

function copyRoomLink() {
    const roomLink = `${window.location.origin}${window.location.pathname}?room=${currentRoom.id}`;
    navigator.clipboard.writeText(roomLink).then(() => {
        showToast('Link copiado!', 'success');
    });
}

function leaveRoom() {
    if (currentRoomRef && currentUser) {
        // Remover jogador da sala
        const updatedPlayers = currentRoom.players.filter(p => p.id !== currentUser.id);
        currentRoomRef.update({ players: updatedPlayers });
        
        // Se for o host e não houver outros jogadores, deletar a sala
        if (currentUser.isHost && updatedPlayers.length === 0) {
            currentRoomRef.remove();
        }
    }
    
    // Limpar referências
    if (chatRef) {
        chatRef.off();
    }
    if (currentRoomRef) {
        currentRoomRef.off();
    }
    
    currentUser = null;
    currentRoom = null;
    currentRoomRef = null;
    chatRef = null;
    
    showScreen('landing-screen');
}

// Funções do Chat
function setupChat() {
    if (!currentRoom || !currentUser) return;
    
    chatRef = database.ref(`rooms/${currentRoom.id}/chat`);
    
    // Listener para novas mensagens
    chatRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        addMessageToChat(message);
    });
    
    // Adicionar mensagem de boas-vindas
    addSystemMessage(`${currentUser.name} entrou na sala!`);
}

function sendMessage() {
    const messageText = elements.chatInput.value.trim();
    
    if (!messageText || !currentRoom || !currentUser) return;
    
    const message = {
        id: generateId(),
        sender: currentUser.name,
        senderId: currentUser.id,
        content: messageText,
        timestamp: Date.now(),
        type: 'user'
    };
    
    // Enviar para o Firebase
    chatRef.push(message);
    
    // Limpar input
    elements.chatInput.value = '';
    
    // Parar indicador de digitação
    stopTypingIndicator();
}

function addMessageToChat(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    if (message.type === 'system') {
        messageDiv.classList.add('system-message');
        messageDiv.innerHTML = `
            <div class="message-content">${message.content}</div>
            <div class="message-time">${formatTime(message.timestamp)}</div>
        `;
    } else {
        if (message.senderId === currentUser.id) {
            messageDiv.classList.add('own-message');
        }
        
        messageDiv.innerHTML = `
            <div class="message-sender">${message.sender}</div>
            <div class="message-content">${message.content}</div>
            <div class="message-time">${formatTime(message.timestamp)}</div>
        `;
    }
    
    elements.chatMessages.appendChild(messageDiv);
    scrollChatToBottom();
}

function addSystemMessage(content) {
    const message = {
        id: generateId(),
        content: content,
        timestamp: Date.now(),
        type: 'system'
    };
    
    chatRef.push(message);
}

function handleTyping() {
    if (!currentRoom || !currentUser) return;
    
    // Limpar timeout anterior
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // Mostrar indicador de digitação
    showTypingIndicator();
    
    // Definir timeout para parar o indicador
    typingTimeout = setTimeout(() => {
        stopTypingIndicator();
    }, 1000);
}

function showTypingIndicator() {
    // Remover indicador existente
    const existingIndicator = elements.chatMessages.querySelector('.typing-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Adicionar novo indicador
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.textContent = `${currentUser.name} está digitando...`;
    elements.chatMessages.appendChild(indicator);
    scrollChatToBottom();
}

function stopTypingIndicator() {
    const indicator = elements.chatMessages.querySelector('.typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function scrollChatToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Funções do Bingo
function generateBingoCard() {
    elements.bingoCard.innerHTML = '';
    
    // Gerar 4 quadrados aleatórios (exemplo simples)
    const items = ['🎯', '🎲', '🎪', '🎨', '🎭', '🎪', '🎯', '🎲'];
    const selectedItems = items.sort(() => 0.5 - Math.random()).slice(0, 4);
    
    selectedItems.forEach((item, index) => {
        const square = document.createElement('div');
        square.className = 'bingo-square';
        square.textContent = item;
        square.dataset.index = index;
        square.addEventListener('click', () => markSquare(square));
        elements.bingoCard.appendChild(square);
    });
}

function markSquare(square) {
    square.classList.toggle('marked');
    checkBingo();
}

function checkBingo() {
    const markedSquares = elements.bingoCard.querySelectorAll('.bingo-square.marked');
    if (markedSquares.length >= 2) { // Exemplo: 2 quadrados marcados = bingo
        elements.bingoBtn.style.display = 'block';
    } else {
        elements.bingoBtn.style.display = 'none';
    }
}

function claimBingo() {
    if (!currentRoom || !currentUser) return;
    
    // Adicionar evento de bingo
    addEventToLog(`${currentUser.name} gritou BINGO! 🎉`);
    
    // Adicionar mensagem no chat
    addSystemMessage(`🎊 ${currentUser.name} GANHOU! BINGO! 🎊`);
    
    // Mostrar notificação
    showNotification(`🎉 Parabéns ${currentUser.name}! Você ganhou! 🎉`);
    
    // Esconder botão
    elements.bingoBtn.style.display = 'none';
}

// Funções auxiliares
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function addEventToLog(event) {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'event-item';
    eventDiv.innerHTML = `
        ${event}
        <span class="event-timestamp">${formatTime(Date.now())}</span>
    `;
    elements.eventsLog.appendChild(eventDiv);
    elements.eventsLog.scrollTop = elements.eventsLog.scrollHeight;
}

function showNotification(message) {
    elements.notificationMessage.textContent = message;
    elements.notificationModal.classList.add('active');
}

function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// Verificar se há parâmetros de URL para entrar automaticamente em uma sala
window.addEventListener('load', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (roomId) {
        // Auto-preenchimento do ID da sala
        elements.joinRoomId.value = roomId;
        showScreen('join-room-screen');
    }
});
