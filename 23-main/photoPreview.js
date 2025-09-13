// photoPreview.js
function showPhoto(photoPath) {
    const photoPreview = document.createElement('div');
    photoPreview.id = 'photoPreview';
    photoPreview.style.position = 'fixed';
    photoPreview.style.top = '50%';
    photoPreview.style.left = '50%';
    photoPreview.style.transform = 'translate(-50%, -50%)';
    photoPreview.style.zIndex = '1000';
    photoPreview.style.padding = '10px';
    photoPreview.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    photoPreview.style.borderRadius = '8px';
    photoPreview.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    photoPreview.innerHTML = `<img src="${photoPath}" alt="Фото" style="max-width: 90vw; max-height: 90vh;">`;
    document.body.appendChild(photoPreview);
}

function hidePhoto() {
    const photoPreview = document.getElementById('photoPreview');
    if (photoPreview) {
        document.body.removeChild(photoPreview);
    }
}

let currentPhotoIndex = 0;
let currentPhotos     = [];

// Галерея
function openPhotoGallery(id) {
    fetch(`fetch_photos.php?id=${id}`)
        .then(response => response.json())
        .then(data => {
            if (data.photos && data.photos.length > 0) {
                currentPhotos = data.photos;
                currentPhotoIndex = 0;
                updatePhotoGallery();
                document.getElementById('photoModal').style.display = 'flex';
            } else {
                alert('Фото отсутствуют.');
            }
        })
        .catch(error => console.error('Ошибка загрузки фото:', error));
}

function updatePhotoGallery() {
    const gallery = document.getElementById('photoGallery');
    gallery.innerHTML = `<img src="${currentPhotos[currentPhotoIndex]}" alt="Фото">`;
}

function closePhotoGallery() {
    document.getElementById('photoModal').style.display = 'none';
}

function prevPhoto() {
    if (currentPhotoIndex > 0) {
        currentPhotoIndex--;
        updatePhotoGallery();
    }
}

function nextPhoto() {
    if (currentPhotoIndex < currentPhotos.length - 1) {
        currentPhotoIndex++;
        updatePhotoGallery();
    }
}
