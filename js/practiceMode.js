import { getActivePractice } from './state.js';
import { escapeAttr, escapeHtml, fuzzyMatch, shuffle } from './utils.js';

export function renderPractice(container) {
  const db = getActivePractice();
  if (!db?.questions?.length) return (container.innerHTML = '<div class="empty-state">No practice test database selected.</div>');

  let timer = null;
  let viewTimer = null;

  const clearTimers = () => {
    if (timer) clearInterval(timer);
    if (viewTimer) clearInterval(viewTimer);
    timer = null;
    viewTimer = null;
  };

  const totalQuestions = db.questions.length;
  const defaultQuestionCount = Math.min(10, totalQuestions);

  container.innerHTML = `<div class='inline-grid'>
    <label><input id='showExplain' type='checkbox'> Include explanations in results</label>
    <label>Questions<input id='questionCount' type='number' value='${defaultQuestionCount}' min='1' max='${totalQuestions}'></label>
    <label>Timer (minutes)<input id='timerMin' type='number' value='5' min='0'></label>
    <button id='startPractice' type='button'>Start Random Practice Test</button>
  </div>
  <p class='sr-note'>Each start uses a new randomized set from the current practice database (${totalQuestions} available).</p>
  <div id='practiceArea'></div>`;

  container.querySelector('#startPractice').onclick = () => {
    clearTimers();
    const showExplain = container.querySelector('#showExplain').checked;
    const requestedCount = +container.querySelector('#questionCount').value || defaultQuestionCount;
    const questionCount = Math.max(1, Math.min(totalQuestions, requestedCount));
    container.querySelector('#questionCount').value = questionCount;

    let seconds = Math.max(0, (+container.querySelector('#timerMin').value || 0) * 60);
    const start = Date.now();
    const selectedQuestions = shuffle(db.questions).slice(0, questionCount);

    const items = selectedQuestions.map((q, i) => {
      if (q.question_type === 'multiple_choice') {
        const choices = shuffle(q.choices || []);
        return `<div class='question' data-id='${escapeAttr(q.id)}' data-answer='${escapeAttr(q.correct_answer)}' data-type='mc'><p>${i + 1}. ${escapeHtml(q.question)}</p>${choices.map((c) => `<label class='choice'><input type='radio' name='p${i}' value='${escapeAttr(c)}'>${escapeHtml(c)}</label>`).join('')}</div>`;
      }
      if (q.question_type === 'true_false') {
        return `<div class='question' data-id='${escapeAttr(q.id)}' data-answer='${escapeAttr(String(q.correct_answer).toLowerCase())}' data-type='tf'><p>${i + 1}. ${escapeHtml(q.question)}</p><label class='choice'><input type='radio' name='p${i}' value='true'>True</label><label class='choice'><input type='radio' name='p${i}' value='false'>False</label></div>`;
      }
      return `<div class='question' data-id='${escapeAttr(q.id)}' data-answer='${escapeAttr(q.correct_answer || (q.acceptable_answers || [])[0] || '')}' data-acceptable='${escapeAttr((q.acceptable_answers || []).join('|'))}' data-type='typed'><p>${i + 1}. ${escapeHtml(q.question)}</p><input type='text' name='p${i}'></div>`;
    }).join('');

    container.querySelector('#practiceArea').innerHTML = `<div class='controls'><span class='badge'>Questions: ${questionCount}/${totalQuestions}</span><span class='badge'>Timer: <span id='timerView'>${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</span></span></div>${items}<button id='submitPractice' type='button'>Finish Practice Test</button><div id='practiceResult'></div>`;
    const timerView = container.querySelector('#timerView');

    const submit = () => {
      clearTimers();
      const blocks = [...container.querySelectorAll('.question')];
      let score = 0;
      const topics = {};
      const missed = [];

      blocks.forEach((block) => {
        const question = selectedQuestions.find((item) => String(item.id) === String(block.dataset.id));
        if (!question) return;

        const type = block.dataset.type;
        const value = type === 'typed'
          ? block.querySelector('input')?.value || ''
          : (block.querySelector('input:checked')?.value || '');
        const acceptable = (block.dataset.acceptable || '').split('|').filter(Boolean);
        const expected = block.dataset.answer || '';
        const ok = type === 'typed'
          ? (fuzzyMatch(value, expected) || acceptable.some((answer) => fuzzyMatch(value, answer)))
          : String(value).toLowerCase() === String(expected).toLowerCase();

        const topicKey = question.topic || 'other';
        topics[topicKey] = topics[topicKey] || { total: 0, correct: 0 };
        topics[topicKey].total++;
        if (ok) {
          score++;
          topics[topicKey].correct++;
        } else {
          missed.push({
            question: question.question,
            expected,
            your: value || '(blank)',
            explanation: question.explanation || ''
          });
        }
      });

      const taken = Math.round((Date.now() - start) / 1000);
      container.querySelector('#practiceResult').innerHTML = `<h3>Practice Results: ${score}/${blocks.length}</h3>
      <p>Time Taken: ${Math.floor(taken / 60)}m ${taken % 60}s</p>
      <p>Randomized from ${totalQuestions} total questions.</p>
      <h4>Topic Breakdown</h4><ul>${Object.entries(topics).map(([k, v]) => `<li>${escapeHtml(k)}: ${v.correct}/${v.total}</li>`).join('')}</ul>
      <h4>Incorrect Answers</h4><ul>${missed.length ? missed.map((m) => `<li><strong>${escapeHtml(m.question)}</strong><br>Expected: ${escapeHtml(m.expected)}<br>Your answer: ${escapeHtml(m.your)}${showExplain ? `<br>Explanation: ${escapeHtml(m.explanation)}` : ''}</li>`).join('') : '<li>Perfect score 🎉</li>'}</ul>`;
      if (!showExplain && missed.length) container.querySelector('#practiceResult').innerHTML += '<p>Enable “Include explanations in results” to view rationale after each missed question.</p>';
    };

    container.querySelector('#submitPractice').onclick = submit;

    container.querySelectorAll('.question[data-type="typed"] input').forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      });
    });

    if (seconds > 0) {
      timer = setInterval(() => {
        seconds--;
        if (timerView) timerView.textContent = `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;
        if (seconds <= 0) submit();
      }, 1000);
    }

    viewTimer = setInterval(() => {
      if (!document.body.contains(container)) clearTimers();
    }, 500);
  };

  container._cleanup = clearTimers;
}
