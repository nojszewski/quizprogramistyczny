const API = {
  gen: 'http://100.82.179.61:5678/webhook/generuj-pytanie',
  save: 'http://100.82.179.61:5678/webhook/zapisz-odpowiedz',
  history: 'http://100.82.179.61:5678/webhook/pobierz-historie-odpowiedzi'
}

async function fetchQuestion(category) {
  try {
    const r = await fetch(API.gen, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ chatInput: category })
    })
    if (!r.ok) throw new Error('POST gen fail')
    const j = await r.json()
    return j
  } catch (e) {
    const q = encodeURIComponent(category);
    const r = await fetch(API.gen + '?chatInput=' + q)
    return r.json()
  }
}

async function postSave(payload) {
  const r = await fetch(API.save, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  })
  return r.ok ? r.json().catch(()=>null) : Promise.reject(await r.text())
}


if (document.getElementById('catForm')) {
  const form = document.getElementById('catForm')
  form.addEventListener('submit', e => {
    e.preventDefault()
    const cat = document.getElementById('category').value
    if (!cat) return
    sessionStorage.setItem('quizCategory', cat)
    const init = { round: 1, correct: 0, answers: [] }
    sessionStorage.setItem('quizState', JSON.stringify(init))
    location.href = 'quiz.html'
  })
}



if (document.getElementById('answersForm')) {
  const catTitle = document.getElementById('catTitle')
  const roundEl = document.getElementById('round')
  const questionEl = document.getElementById('pytanie')
  const answersForm = document.getElementById('answersForm')
  const submitBtn = document.getElementById('submitBtn')
  const msg = document.getElementById('msg')

  let quizState = JSON.parse(sessionStorage.getItem('quizState') || '{"round":1,"correct":0,"answers":[]}')
  const category = sessionStorage.getItem('quizCategory') || ''

  catTitle.textContent = category || '—'
  roundEl.textContent = quizState.round

  let currentQuestion = null

  async function loadQuestion() {
    msg.textContent = '';
    questionEl.textContent = 'Ładowanie...';
    answersForm.innerHTML = '';
    submitBtn.disabled = true;

    try {
      const data = await fetchQuestion(category);

      const item = Array.isArray(data) ? data[0] : data;
      const out = item.output || item;
      currentQuestion = out;
      renderQuestion(out);
      submitBtn.disabled = false;
    } catch (err) {
      questionEl.textContent = 'Błąd pobierania pytania';
      msg.textContent = String(err);
    }
  }

  function renderQuestion(q) {
    questionEl.textContent = q.pytanie || 'Brak treści';
    const opts = [
      {k:'A', t:q.odpA || ''},
      {k:'B', t:q.odpB || ''},
      {k:'C', t:q.odpC || ''},
      {k:'D', t:q.odpD || ''},
    ];

    answersForm.innerHTML = '';

    opts.forEach(o => {
      const label = document.createElement('label');
      label.className = 'answer';

      const input = document.createElement('input');
      input.name = 'ans';
      input.type = 'radio';
      input.value = o.k;
      input.required = true;

      const div = document.createElement('div');
      div.textContent = `${o.k}. ${o.t}`;

      label.appendChild(input);
      label.appendChild(div);
      answersForm.appendChild(label);
    });
  }

  submitBtn.addEventListener('click', async () => {
    const sel = answersForm.querySelector('input[name="ans"]:checked');
    if (!sel) { msg.textContent = 'Wybierz odpowiedź'; return; }
    const userAns = sel.value;

    const correct = (currentQuestion.poprawnaOdp || '').toString().toUpperCase();
    const isCorrect = userAns === correct;

    const payload = {
      pytanie: currentQuestion.pytanie,
      odpA: currentQuestion.odpA,
      odpB: currentQuestion.odpB,
      odpC: currentQuestion.odpC,
      odpD: currentQuestion.odpD,
      poprawnaOdp: correct,
      odpowiedz_usera: userAns,
      kategoria: sessionStorage.getItem('quizCategory') || ''
    };
    submitBtn.disabled = true;
    msg.textContent = 'Zapis...';

    try {
      await postSave(payload);

      quizState.answers.push({ ...payload, czy_poprawny: isCorrect });
      if (isCorrect) quizState.correct++;
      if (quizState.round >= 4) {

        sessionStorage.setItem('quizState', JSON.stringify(quizState));
        location.href = 'results.html';
        return;
      }

      quizState.round++;
      sessionStorage.setItem('quizState', JSON.stringify(quizState));
      roundEl.textContent = quizState.round;
      msg.textContent = '';
      await loadQuestion();
    } catch (err) {
      msg.textContent = 'Błąd zapisu: ' + (err && err.toString ? err.toString() : err);
      submitBtn.disabled = false;
    }
  });

  loadQuestion();
}



if (document.getElementById('score')) {
  const scoreEl = document.getElementById('score');
  const details = document.getElementById('details');
  const retry = document.getElementById('retry');
  const state = JSON.parse(sessionStorage.getItem('quizState') || '{"round":1,"correct":0,"answers":[]}');
  const correct = state.correct || 0;
  scoreEl.textContent = `${correct} / 4`;

  function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const answers = state.answers || [];
  if (answers.length === 0) {
    details.textContent = 'Brak szczegółów.';
  } else {
    const table = document.createElement('table');
    table.className = 'results-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>#</th><th>Pytanie</th><th>Twoja odpowiedź</th><th>Poprawna</th><th></th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    answers.forEach((a, i) => {
      const tr = document.createElement('tr');

      const tdIndex = document.createElement('td');
      tdIndex.className = 'center';
      tdIndex.textContent = (i + 1);

      const tdQ = document.createElement('td');
      tdQ.className = 'question-cell';
      tdQ.textContent = a.pytanie || '';

      const tdYour = document.createElement('td');
      tdYour.className = 'mono';
      tdYour.textContent = a.odpowiedz_usera || '-';

      const tdCorrect = document.createElement('td');
      tdCorrect.className = 'mono';
      tdCorrect.textContent = a.poprawnaOdp || '-';

      const tdOk = document.createElement('td');
      tdOk.className = a.czy_poprawny ? 'ok' : 'bad';
      tdOk.classList.add('center');
      tdOk.textContent = a.czy_poprawny ? '✓' : '✗';

      tr.appendChild(tdIndex);
      tr.appendChild(tdQ);
      tr.appendChild(tdYour);
      tr.appendChild(tdCorrect);
      tr.appendChild(tdOk);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    details.innerHTML = '';
    details.appendChild(table);
  }
  retry.addEventListener('click', () => location.href = 'index.html');

  sessionStorage.removeItem('quizState');
  sessionStorage.removeItem('quizCategory');
}



if (document.getElementById('historyList')) {
  const list = document.getElementById('historyList');
  const loading = document.getElementById('loading');
  async function loadHistory() {
    loading.textContent = 'Ładowanie historii...';
    try {
      const r = await fetch(API.history);
      if (!r.ok) throw new Error('fetch history fail');
      const data = await r.json();
      if (!Array.isArray(data) || data.length === 0) {
        loading.textContent = 'Brak wpisów w historii.';
        return;
      }

      function pick(obj, names) {
        for (const n of names) {
          if (obj == null) break;
          if (Object.prototype.hasOwnProperty.call(obj, n) && obj[n] != null) return obj[n];
        }
        return undefined;
      }

      loading.remove();
      data.slice().reverse().forEach(raw => {
        const when = pick(raw, ['created_at']) || '';
        const kat = pick(raw, ['kategoria','Kategoria','category','Category']) || '-';
        const pytanie = pick(raw, ['pytanie','Pytanie','question','Question']) || '';
        const odpUser = pick(raw, ['odpowiedz_usera','OdpUsera','OdpUsera','OdpUser','OdpUsera'.toString()]) || pick(raw, ['OdpUsera','OdpUser','OdpUsera']) || pick(raw, ['odpowiedzUser','odpUser']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUser']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || raw.OdpUsera || raw.OdpUser || raw.odpUser || raw.odpowiedz_usera || raw.OdpUsera || raw.OdpUser || raw.OdpUsera || raw.OdpUser;
        const poprawna = pick(raw, ['poprawnaOdp','PoprawnaOdp','poprawna_odp','Poprawna_odp']) || '-';

        const item = document.createElement('li');
        item.className = 'historyItem';

        const kv = document.createElement('div');
        kv.className = 'kv';
        const strong = document.createElement('strong');
        strong.textContent = when;
        const span = document.createElement('span');
        span.className = 'muted';
        span.textContent = ' | ' + kat;
        kv.appendChild(strong);
        kv.appendChild(span);

        const qdiv = document.createElement('div');
        qdiv.className = 'small';
        qdiv.textContent = pytanie;

        const info = document.createElement('div');
        info.className = 'small muted';
        info.textContent = `twoja: ${odpUser || '-'} • poprawna: ${poprawna}`;

        item.appendChild(kv);
        item.appendChild(qdiv);
        item.appendChild(info);

        list.appendChild(item);
      });
    } catch (err) {
      loading.textContent = 'Błąd: ' + err;
    }
  }
  loadHistory();
}
