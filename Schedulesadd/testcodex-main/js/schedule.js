// Справочники
const MP_ABBR = { wildberries:'WB', ozon:'OZ', yandexmarket:'YM' };
const ORIGIN_NAME = {
  mahachkala:'Махачкала', kizilyurt:'Кизилюрт', kizlyar:'Кизляр', khasavyurt:'Хасавюрт'
};

// Пример данных: dayOfWeek: 0..5 (Пн..Сб) — Воскресенье не используется
const SHIPMENTS = [
  // Махачкала
  { mp:'wildberries', from:'mahachkala', to:'Воронеж',            dow:0 },
  { mp:'wildberries', from:'mahachkala', to:'Волгоград',          dow:1 },
  { mp:'wildberries', from:'mahachkala', to:'Невинномысск',       dow:3 },
  { mp:'wildberries', from:'mahachkala', to:'Рязань',             dow:4 },
  // Кизилюрт
  { mp:'wildberries', from:'kizilyurt',  to:'Екатеринбург — Перспективный 12/2', dow:0 },
  { mp:'wildberries', from:'kizilyurt',  to:'Сарапул',            dow:1 },
  { mp:'wildberries', from:'kizilyurt',  to:'Казань',             dow:2 },
  { mp:'wildberries', from:'kizilyurt',  to:'Тула',               dow:3 },
  // Кизляр
  { mp:'wildberries', from:'kizlyar',    to:'Екатеринбург — Перспективный 12/2', dow:0 },
  { mp:'wildberries', from:'kizlyar',    to:'Сарапул',            dow:1 },
  { mp:'wildberries', from:'kizlyar',    to:'Казань',             dow:2 },
  { mp:'wildberries', from:'kizlyar',    to:'Тула',               dow:3 },
  { mp:'wildberries', from:'kizlyar',    to:'Невинномысск',       dow:4 },
  { mp:'wildberries', from:'kizlyar',    to:'Рязань',             dow:5 },
  // Хасавюрт
  { mp:'wildberries', from:'khasavyurt', to:'Краснодар',          dow:0 },
  { mp:'wildberries', from:'khasavyurt', to:'Ростов-на-Дону',     dow:1 },
  { mp:'wildberries', from:'khasavyurt', to:'Казань',             dow:2 },
  { mp:'wildberries', from:'khasavyurt', to:'Тула',               dow:3 },
  { mp:'wildberries', from:'khasavyurt', to:'Невинномысск',       dow:4 },
  { mp:'wildberries', from:'khasavyurt', to:'Рязань',             dow:5 },
];

// Дата: понедельник текущей недели
const mondayOf = (d0)=>{
  const d=new Date(d0); const wd=d.getDay(); const diff=d.getDate()-(wd===0?6:wd-1);
  d.setDate(diff); d.setHours(0,0,0,0); return d;
};
let weekStart = mondayOf(new Date());

// Узлы
const selMp   = document.getElementById('marketplace');
const cityTabs = Array.from(document.querySelectorAll('.city-tab'));
const grid    = document.getElementById('grid');
const rangeEl = document.getElementById('range');

let selectedOrigin = cityTabs.find(btn => btn.classList.contains('active'))?.dataset.origin || '';

// Рендер недели
function render() {
  grid.innerHTML = '';

  // Дни Пн..Сб
  const days = [];
  for (let i=0;i<6;i++){ const d=new Date(weekStart); d.setDate(d.getDate()+i); days.push(d); }

  // Фильтры
  const fMp   = selMp.value;
  const fFrom = selectedOrigin;

  // Диапазон
  const fmt = (d,opts)=>d.toLocaleDateString('ru-RU',opts);
  rangeEl.textContent = `${fmt(days[0],{day:'2-digit',month:'2-digit'})} – ${fmt(days[5],{day:'2-digit',month:'2-digit'})}`;

  days.forEach((dayDate,idx)=>{
    const daySection = document.createElement('section');
    daySection.className = 'timeline-day';

    const head = document.createElement('header');
    head.className = 'timeline-day__header';

    const weekdayText = fmt(dayDate,{ weekday:'long' });
    const weekday = weekdayText.charAt(0).toUpperCase() + weekdayText.slice(1);
    const weekdayEl = document.createElement('span');
    weekdayEl.className = 'timeline-day__weekday';
    weekdayEl.textContent = weekday;

    const dateEl = document.createElement('span');
    dateEl.className = 'timeline-day__date';
    dateEl.textContent = fmt(dayDate,{ day:'2-digit', month:'2-digit', year:'numeric' });

    head.appendChild(weekdayEl);
    head.appendChild(dateEl);
    daySection.appendChild(head);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'timeline-day__cards';

    const items = SHIPMENTS.filter(s =>
      s.dow===idx && (!fMp || s.mp===fMp) && (!fFrom || s.from===fFrom)
    );

    if (items.length===0) {
      const empty = document.createElement('div');
      empty.className = 'timeline-day__empty';
      empty.textContent = 'Нет отправлений';
      cardsWrap.appendChild(empty);
    } else {
      items.forEach(s=>{
        const card = document.createElement('div');
        card.className = 'shipment';
        // СКЛАД
        const t = document.createElement('p');
        t.className = 'ship-title';
        t.textContent = s.to;
        card.appendChild(t);

        // Сдача на [MP] : [дата]
        const delivery = new Date(dayDate);
        delivery.setDate(delivery.getDate()+6);
        const sub = document.createElement('p');
        sub.className='ship-sub';
        sub.textContent = `Сдача на ${MP_ABBR[s.mp]||s.mp.toUpperCase().slice(0,2)} : ${fmt(delivery,{day:'2-digit',month:'2-digit',year:'numeric'})}`;
        card.appendChild(sub);

        card.addEventListener('click', ()=>openModal(s, dayDate, delivery));
        cardsWrap.appendChild(card);
      });
    }

    daySection.appendChild(cardsWrap);
    grid.appendChild(daySection);
  });
}

// Модалка
const ovl = document.getElementById('ovl');
const mTitle = document.getElementById('m-title');
const mMp = document.getElementById('m-mp');
const mFrom = document.getElementById('m-from');
const mTo = document.getElementById('m-to');
const mDate = document.getElementById('m-date');
const mDelivery = document.getElementById('m-delivery');

function openModal(s, shipDate, deliveryDate){
  mTitle.textContent = `${ORIGIN_NAME[s.from]||s.from} → ${s.to}`;
  mMp.textContent = s.mp[0].toUpperCase()+s.mp.slice(1);
  mFrom.textContent = ORIGIN_NAME[s.from]||s.from;
  mTo.textContent = s.to;
  mDate.textContent = shipDate.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
  mDelivery.textContent = deliveryDate.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
  ovl.style.display='flex';
}
document.getElementById('m-close').onclick=()=>ovl.style.display='none';
ovl.addEventListener('click',e=>{ if(e.target===ovl) ovl.style.display='none'; });

// Навигация
document.getElementById('prev').onclick = ()=>{ weekStart.setDate(weekStart.getDate()-7); render(); };
document.getElementById('next').onclick = ()=>{ weekStart.setDate(weekStart.getDate()+7); render(); };

// Фильтры
selMp.onchange = render;
cityTabs.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) return;
    cityTabs.forEach(tab => tab.classList.remove('active'));
    btn.classList.add('active');
    selectedOrigin = btn.dataset.origin || '';
    render();
  });
});

// Старт
render();