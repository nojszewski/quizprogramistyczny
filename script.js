const API = {
  gen: 'http://192.168.222.173:5678/webhook/generuj-pytanie',
  save: 'http://192.168.222.173:5678/webhook/zapisz-odpowiedz',
  history: 'http://192.168.222.173:5678/webhook/pobierz-historie-odpowiedzi'
};

async function fetchQuestion(category) {
  try {
    const r = await fetch(API.gen, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ chatInput: category })
    });
    if (!r.ok) throw new Error('POST gen fail');
    const j = await r.json();
    return j;
  } catch (e) {
    const q = encodeURIComponent(category);
    const r = await fetch(API.gen + '?chatInput=' + q);
    if (!r.ok) throw new Error('GET gen fail');
    return r.json();
  }
}

async function postSave(payload) {
  const r = await fetch(API.save, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  return r.ok ? r.json().catch(()=>null) : Promise.reject(await r.text());
}


if (document.getElementById('catForm')) {
  const form = document.getElementById('catForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const cat = document.getElementById('category').value;
    if (!cat) return;
    sessionStorage.setItem('quizCategory', cat);
    // init state
    const init = { round: 1, correct: 0, answers: [] };
    sessionStorage.setItem('quizState', JSON.stringify(init));
    location.href = 'quiz.html';
  });
}


if (document.getElementById('answersForm')) {
  const catTitle = document.getElementById('catTitle');
  const roundEl = document.getElementById('round');
  const questionEl = document.getElementById('pytanie');
  const answersForm = document.getElementById('answersForm');
  const submitBtn = document.getElementById('submitBtn');
  const prevBtn = document.getElementById('prevBtn');
  const msg = document.getElementById('msg');

  let quizState = JSON.parse(sessionStorage.getItem('quizState') || '{"round":1,"correct":0,"answers":[]}');
  const category = sessionStorage.getItem('quizCategory') || '';

  catTitle.textContent = category || '—';
  roundEl.textContent = quizState.round;

  let currentQuestion = null;

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
      {k:'A', t:q.odpA},
      {k:'B', t:q.odpB},
      {k:'C', t:q.odpC},
      {k:'D', t:q.odpD},
    ];
    answersForm.innerHTML = opts.map(o => `
      <label class="answer">
        <input name="ans" type="radio" value="${o.k}" required />
        <div>${o.k}. ${o.t}</div>
      </label>
    `).join('');
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

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      alert('Nieobsługiwane — quiz idzie w przód.');
    });
  }

  loadQuestion();
}


if (document.getElementById('score')) {
  const scoreEl = document.getElementById('score');
  const details = document.getElementById('details');
  const retry = document.getElementById('retry');

  const state = JSON.parse(sessionStorage.getItem('quizState') || '{"round":1,"correct":0,"answers":[]}');
  const correct = state.correct || 0;
  scoreEl.textContent = `${correct} / 4`;

  const lines = (state.answers || []).map((a,i)=> {
    return `${i+1}. ${a.pytanie} — twoja: ${a.odpowiedz_usera} | poprawna: ${a.poprawnaOdp} ${a.czy_poprawny ? '✓' : '✗'}`;
  }).join('\n\n');

  details.textContent = lines || 'Brak szczegółów.';
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
      loading.remove();
      data.reverse().forEach(it => {

        const when = it.timestamp || it.date || it.time || '';
        const kat = it.kategoria || it.category || '-';
        const correct = (it.czy_poprawny && it.czy_poprawny === true) ? 1 : (it.czy_poprawny ? 1:0);
        const item = document.createElement('li');
        item.className = 'historyItem';
        item.innerHTML = `
          <div class="kv"><strong>${when}</strong><span class="muted"> | ${kat}</span></div>
          <div class="small">${it.pytanie || ''}</div>
          <div class="small muted">twoja: ${it.odpowiedz_usera || '-'} • poprawna: ${it.poprawnaOdp || '-'}</div>
        `;
        list.appendChild(item);
      });
    } catch (err) {
      loading.textContent = 'Błąd: ' + err;
    }
  }
  loadHistory();
}
