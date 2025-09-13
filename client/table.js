// ===== table.js =====

function fetchDataAndDisplayTable(city = '') {
    let url = 'fetch_data.php';
    if (city) url += `?city=${encodeURIComponent(city)}`;

    fetch(url)
        .then(r => r.json())
        .then(data => {
            const tbl = document.getElementById('tableContainer');
            const pag = document.getElementById('paginationContainer');
            if (!tbl) return console.error('tableContainer не найден');

            if (!data.length) {
                tbl.innerHTML = '<p>Нет данных для отображения.</p>';
                pag.style.display = 'none';
                return;
            }
            pag.style.display = 'flex';

            const perPage = 10;
            const total   = Math.ceil(data.length / perPage);
            let current   = 1;

            function renderPage(page) {
                const start = (page-1)*perPage;
                const slice = data.slice(start, start+perPage);

                let html = `
                  <div style="text-align:right; margin-bottom:8px;">
                    <input type="text" id="filterInput"
                           onkeyup="filterTable()" placeholder="Поиск..." class="filter-input">
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Отправитель</th><th>Направление</th><th>Дата сдачи</th>
                        <th>Дата приёмки</th><th>Время приёмки</th><th>Тип отправки</th>
                        <th>Количество</th><th>Сумма оплаты</th><th>Способ оплаты</th>
                        <th>Фото</th><th>Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                `;
                slice.forEach(r => {
                    html += `
                      <tr>
                        <td>${r.sender}</td>
                        <td>${r.direction||'—'}</td>
                        <td>${r.date_of_delivery||'—'}</td>
                        <td>${r.submission_date||'—'}</td>
                        <td>${r.accept_time||'—'}</td>
                        <td>${r.shipment_type||'—'}</td>
                        <td>${r.boxes||0}</td>
                        <td>${r.payment||0}</td>
                        <td>${r.payment_type||'—'}</td>
                        <td style="text-align:center;">
                          ${ r.photo_thumb
                              ? `<img src="${r.photo_thumb}" style="max-width:50px;cursor:pointer;"
                                       onclick="openPhotoGallery(${r.id})">`
                              : 'Нет фото'
                          }
                        </td>
                        <td>${r.comment||'—'}</td>
                      </tr>
                    `;
                });
                html += `</tbody></table>`;
                tbl.innerHTML = html;
            }

            function renderPager() {
                pag.innerHTML = '';
                const m = 3;
                function btn(p,t,act=false){
                    const b = document.createElement('button');
                    b.textContent = t; b.classList.add('pagination-button');
                    if (act) b.classList.add('active');
                    b.onclick = ()=>changePage(p);
                    return b;
                }
                function ell(){ const s=document.createElement('span'); s.textContent='…'; s.classList.add('pagination-ellipsis'); return s; }

                if (current>1) pag.appendChild(btn(1,'1'));
                if (current>m+2) pag.appendChild(ell());

                const start = Math.max(1, current-m);
                const end   = Math.min(total, current+m);
                for (let i=start; i<=end; i++){
                    pag.appendChild(btn(i, i, i===current));
                }

                if (current<total-m-1) pag.appendChild(ell());
                if (current<total)      pag.appendChild(btn(total, total));
            }

            window.changePage = function(p){
                current = p;
                renderPage(p);
                renderPager();
            };

            renderPage(1);
            renderPager();
        })
        .catch(err => {
            console.error('Ошибка:', err);
            document.getElementById('tableContainer').innerHTML =
                '<p>Ошибка при загрузке данных.</p>';
        });
}

function filterTable() {
    const v = document.getElementById('filterInput').value.toLowerCase();
    document.querySelectorAll('#tableContainer table tbody tr')
        .forEach(row => {
            const show = [...row.cells].some(c =>
                c.textContent.toLowerCase().includes(v)
            );
            row.style.display = show ? '' : 'none';
        });
}

function exportAllDataToExcel() {
    fetch('fetch_data.php')
        .then(r => r.json())
        .then(data => {
            if (!data.length) return alert('Нет данных для выгрузки.');
            const aoa = [['ID','Город','Отправитель','Направление','Дата сдачи',
                          'Тип','Кол-во','Оплата','Способ','Дата приёмки','Фото','Комментарий']];
            data.forEach(r=>{
                aoa.push([
                    r.id, r.city, r.sender, r.direction, r.date_of_delivery,
                    r.shipment_type, r.boxes, r.payment, r.payment_type,
                    r.submission_date,
                    r.photo_paths.length? r.photo_paths.join(',') : '',
                    r.comment || ''
                ]);
            });
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Все данные');
            XLSX.writeFile(wb, 'all_data.xlsx');
        })
        .catch(e => { console.error(e); alert('Ошибка при выгрузке.'); });
}

function openPhotoGallery(id) {
    fetch(`fetch_photos.php?id=${id}`)
        .then(r=>r.json())
        .then(d=>{
            const modal = document.createElement('div');
            modal.className = 'photo-modal';
            modal.innerHTML = `
              <div class="photo-modal-content">
                <span class="photo-modal-close" onclick="this.parentElement.parentElement.remove()">×</span>
                <div class="photo-gallery">
                  ${d.photos.map(p=>`<img src="${p}">`).join('')}
                </div>
              </div>`;
            document.body.appendChild(modal);
        })
        .catch(e=>console.error('Ошибка фото:',e));
}
