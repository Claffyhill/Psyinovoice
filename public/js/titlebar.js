const minimizeButton = document.getElementById('minimize-btn');
const maximizeButton = document.getElementById('maximize-btn');
const closeButton = document.getElementById('close-btn');

function updateMaximizeButton(isMaximized) {
    maximizeButton.textContent = isMaximized ? '❐' : '□';
    maximizeButton.setAttribute(
        'aria-label',
        isMaximized ? 'Restaurar' : 'Maximizar'
    );
    maximizeButton.title = isMaximized ? 'Restaurar' : 'Maximizar';
}

minimizeButton.addEventListener('click', () => {
    window.electronAPI.minimize();
});

maximizeButton.addEventListener('click', () => {
    window.electronAPI.maximize();
});

closeButton.addEventListener('click', () => {
    window.electronAPI.close();
});

window.electronAPI.getMaximized().then(updateMaximizeButton);
window.electronAPI.onMaximizedChange(updateMaximizeButton);
