import { getActiveStudy, filterStudyCards, state } from './state.js';
import { escapeHtml, shuffle } from './utils.js';

export function renderMatchGame(container) {
  const db = getActiveStudy();
  if (!db?.cards?.length) return (container.innerHTML = '<div class="empty-state">Need cards to play.</div>');

  container.innerHTML = `<div class='inline-grid'>
    <label>Pairs <input id='pairCount' type='number' min='2' max='12' value='6'></label>
    <label>Difficulty <select id='matchDifficulty'><option value=''>Any</option><option>easy</option><option>medium</option><option>hard</option></select></label>
    <button id='generateMatch' type='button'>Generate Round</button>
  </div>
  <div id='matchArea'></div>`;

  const renderRound = () => {
    const diff = container.querySelector('#matchDifficulty').value;
    const basePool = filterStudyCards(db.cards, {
      dbId: db.id,
      search: state.filters.search,
      difficulty: state.filters.difficulty,
      favoritesOnly: state.filters.favoritesOnly,
      sort: ''
    });
    const source = diff ? basePool.filter((card) => card.difficulty === diff) : basePool;

    if (source.length < 2) {
      container.querySelector('#matchArea').innerHTML = '<div class="empty-state">Need at least 2 matching cards for a round. Clear filters or import more cards.</div>';
      return;
    }

    const maxPairs = Math.min(12, source.length);
    const requestedPairs = +container.querySelector('#pairCount').value || 6;
    const pairCount = Math.max(2, Math.min(maxPairs, requestedPairs));
    container.querySelector('#pairCount').value = pairCount;

    const cards = shuffle(source).slice(0, pairCount);
    const tiles = shuffle([
      ...cards.map((card) => ({ key: card.id, text: card.term, side: 'term' })),
      ...cards.map((card) => ({ key: card.id, text: card.translation, side: 'translation' }))
    ]);

    let first = null;
    let matched = 0;
    let lockBoard = false;

    container.querySelector('#matchArea').innerHTML = `<h3>Match Game</h3><p>Tap a term and translation pair.</p><div class='match-board'>${tiles.map((tile) => `<button class='tile' type='button' data-key='${tile.key}' data-side='${tile.side}'>${escapeHtml(tile.text)}</button>`).join('')}</div><p id='gameStatus'>Matched 0/${cards.length}</p>`;

    const statusEl = container.querySelector('#gameStatus');
    const buttons = [...container.querySelectorAll('.tile')];

    const updateStatus = () => {
      statusEl.textContent = matched === cards.length ? 'Complete! Great speed round.' : `Matched ${matched}/${cards.length}`;
    };

    buttons.forEach((tile) => {
      tile.onclick = () => {
        if (lockBoard || tile.disabled) return;

        if (!first) {
          first = tile;
          tile.classList.add('selected');
          return;
        }

        if (first === tile) return;

        if (first.dataset.side === tile.dataset.side) {
          first.classList.remove('selected');
          first = tile;
          tile.classList.add('selected');
          return;
        }

        tile.classList.add('selected');
        const samePair = first.dataset.key === tile.dataset.key;

        if (samePair) {
          first.disabled = true;
          tile.disabled = true;
          first.classList.remove('selected');
          tile.classList.remove('selected');
          first.classList.add('matched');
          tile.classList.add('matched');
          first = null;
          matched++;
          updateStatus();
          return;
        }

        const previous = first;
        lockBoard = true;
        setTimeout(() => {
          previous.classList.remove('selected');
          tile.classList.remove('selected');
          first = null;
          lockBoard = false;
        }, 180);
      };
    });

    updateStatus();
  };

  container.querySelector('#generateMatch').onclick = renderRound;
  renderRound();
}
