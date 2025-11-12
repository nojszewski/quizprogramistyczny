const API = {
  gen: 'http://192.168.222.173:5678/webhook/generuj-pytanie',
  save: 'http://192.168.222.173:5678/webhook/zapisz-odpowiedz',
  history: 'http://192.168.222.173:5678/webhook/pobierz-historie-odpowiedzi'
};


async function fetchJSON(url, options = {}) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(`fetch fail: ${r.status}`);
  return r.json();
}

async function fetchQuestion(category) {
  const body = JSON.stringify({ chatInput: category });
  try {
    return await fetchJSON(API.gen, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body
    });
  } catch {
    const q = encodeURIComponent(category);
    return fetchJSON(`${API.gen}?chatInput=${q}`);
  }
}

async function postSave(payload) {
  return fetchJSON(API.save, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  }).catch(() => null);
}


const catForm = document.getElementById('catForm');
if (catForm) {
  catForm.addEventListener('submit', e => {
    e.preventDefault();
    const cat = document.getElementById('category').value.trim();
    if (!cat) return;
    sessionStorage.setItem('quizCategory', cat);
    sessionStorage.setItem('quizState', JSON.stringify({ round: 1, correct: 0, answers: [] }));
    location.href = 'quiz.html';
  });
}



const answersForm = document.getElementById('answersForm');
if (answersForm) {
  const catTitle = document.getElementById('catTitle');
  const roundEl = document.getElementById('round');
  const questionEl = document.getElementById('pytanie');
  const submitBtn = document.getElementById('submitBtn');
  const msg = document.getElementById('msg');

  // Domyślnie chowamy przycisk dopóki pytanie się nie załaduje
  if (submitBtn) submitBtn.style.display = 'none';

  const category = sessionStorage.getItem('quizCategory') || '';
  let quizState = JSON.parse(sessionStorage.getItem('quizState') || '{"round":1,"correct":0,"answers":[]}');
  let currentQuestion = null;

  catTitle.textContent = category || '—';
  roundEl.textContent = quizState.round;

  async function loadQuestion() {
    msg.textContent = '';
    questionEl.textContent = 'Ładowanie...';
    answersForm.innerHTML = '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.display = 'none';
    }

    try {
      const data = await fetchQuestion(category);
      const q = (Array.isArray(data) ? data[0] : data).output || data;
      currentQuestion = q;
      renderQuestion(q);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.display = '';
      }
    } catch {
      questionEl.textContent = 'Błąd pobierania pytania';
    }
  }

  function renderQuestion(q) {
    questionEl.textContent = q.pytanie || 'Brak treści';
    answersForm.innerHTML = '';
    ['A','B','C','D'].forEach(k => {
      const label = document.createElement('label');
      label.className = 'answer';
      label.innerHTML = `
        <input type="radio" name="ans" value="${k}" required>
        <div>${k}. ${q['odp' + k] || ''}</div>`;
      answersForm.appendChild(label);
    });
  }

  submitBtn.addEventListener('click', async () => {
    const sel = answersForm.querySelector('input[name="ans"]:checked');
    if (!sel) return (msg.textContent = 'Wybierz odpowiedź');

    const userAns = sel.value;
    const correct = (currentQuestion.poprawnaOdp || '').toUpperCase();
    const isCorrect = userAns === correct;
    msg.textContent = 'Zapis...';
    submitBtn.disabled = true;

    const payload = {
      ...currentQuestion,
      poprawnaOdp: correct,
      odpowiedz_usera: userAns,
      kategoria: category
    };

    try {
      await postSave(payload);
      quizState.answers.push({ ...payload, czy_poprawny: isCorrect });
      if (isCorrect) quizState.correct++;
      quizState.round++;

      if (quizState.round > 4) {
        sessionStorage.setItem('quizState', JSON.stringify(quizState));
        return location.href = 'results.html';
      }

      sessionStorage.setItem('quizState', JSON.stringify(quizState));
      roundEl.textContent = quizState.round;
      msg.textContent = '';
      await loadQuestion();
    } catch (err) {
      msg.textContent = 'Błąd zapisu: ' + err;
      // Pokaż i odblokuj przycisk tak, by użytkownik mógł spróbować ponownie
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.display = '';
      }
    }
  });

  loadQuestion();
}



const scoreEl = document.getElementById('score');
if (scoreEl) {
  const details = document.getElementById('details');
  const retry = document.getElementById('retry');
  const state = JSON.parse(sessionStorage.getItem('quizState') || '{"correct":0,"answers":[]}');

  scoreEl.textContent = `${state.correct || 0} / 4`;

  const answers = state.answers || [];
  if (!answers.length) {
    details.textContent = 'Brak szczegółów.';
  } else {
    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
      <thead><tr><th>#</th><th>Pytanie</th><th>Twoja</th><th>Poprawna</th><th></th></tr></thead>
      <tbody>
        ${answers.map((a, i) => `
          <tr>
            <td class="center">${i + 1}</td>
            <td class="question-cell">${a.pytanie || ''}</td>
            <td class="mono">${a.odpowiedz_usera || '-'}</td>
            <td class="mono">${a.poprawnaOdp || '-'}</td>
            <td class="center ${a.czy_poprawny ? 'ok' : 'bad'}">${a.czy_poprawny ? '✓' : '✗'}</td>
          </tr>`).join('')}
      </tbody>`;
    details.innerHTML = '';
    details.appendChild(table);
  }

  retry.onclick = () => location.href = 'index.html';
  sessionStorage.removeItem('quizState');
  sessionStorage.removeItem('quizCategory');
}



const historyList = document.getElementById('historyList');
if (historyList) {
  const loading = document.getElementById('loading');

  const pick = (o, keys) => keys.find(k => o?.[k] != null) && o[keys.find(k => o?.[k] != null)];

  async function loadHistory() {
    loading.textContent = 'Ładowanie historii...';
    try {
      const data = await fetchJSON(API.history);
      if (!Array.isArray(data) || !data.length) return (loading.textContent = 'Brak wpisów.');

      loading.remove();
      data.reverse().forEach(d => {
        const when = pick(d, ['created_at']) || '';
        const kat = pick(d, ['kategoria','Kategoria','category']) || '-';
        const pytanie = pick(d, ['pytanie','Pytanie','question']) || '';
        const odpUser = pick(d, ['odpowiedz_usera','OdpUsera','OdpUsera','OdpUser','OdpUsera'.toString()]) || pick(raw, ['OdpUsera','OdpUser','OdpUsera']) || pick(raw, ['odpowiedzUser','odpUser']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUser']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || pick(raw, ['OdpUsera']) || raw.OdpUsera || raw.OdpUser || raw.odpUser || raw.odpowiedz_usera || raw.OdpUsera || raw.OdpUser || raw.OdpUsera || raw.OdpUser;
        const poprawna = pick(d, ['poprawnaOdp','PoprawnaOdp']) || '-';

        const li = document.createElement('li');
        li.className = 'historyItem';
        li.innerHTML = `
          <div class="kv"><strong>${when}</strong><span class="muted"> | ${kat}</span></div>
          <div class="small">${pytanie}</div>
          <div class="small muted">twoja: ${odpUser} • poprawna: ${poprawna}</div>`;
        historyList.appendChild(li);
      });
    } catch (e) {
      loading.textContent = 'Błąd: ' + e;
    }
  }

  loadHistory();
}
