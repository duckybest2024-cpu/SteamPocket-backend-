const CheckersGame = (() => {
  // Board values
  const EMPTY   = 0;
  const RED     = 1;
  const BLACK   = 2;
  const RED_K   = 3;
  const BLACK_K = 4;

  function isRed(v)   { return v === RED   || v === RED_K; }
  function isBlack(v) { return v === BLACK || v === BLACK_K; }
  function isKing(v)  { return v === RED_K || v === BLACK_K; }

  function belongsTo(v, color) {
    return color === 'red' ? isRed(v) : isBlack(v);
  }

  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  // Convert backend gameState to frontend format.
  // Backend turn: 0 (player 0 = red) | 1 (player 1 = black)
  // Frontend turn: 'red' | 'black'
  function normalizeCheckersState(gs) {
    if (!gs) return {};
    let turn = gs.turn;
    if (turn === 0) turn = 'red';
    else if (turn === 1) turn = 'black';
    return { ...gs, turn };
  }

  // Returns { moves: [[r,c]], jumps: [[r,c]] }  for a single piece
  function getPieceMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return { moves: [], jumps: [] };

    const dirs = [];
    if (isRed(piece))   dirs.push([-1, -1], [-1, 1]);   // red moves up (row decreases)
    if (isBlack(piece)) dirs.push([1, -1],  [1, 1]);    // black moves down
    if (isKing(piece)) {
      // Kings move both directions — ensure no dupes
      if (isRed(piece))   dirs.push([1, -1], [1, 1]);
      if (isBlack(piece)) dirs.push([-1, -1], [-1, 1]);
    }

    const moves = [];
    const jumps = [];

    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const neighbor = board[nr][nc];

      if (neighbor === EMPTY) {
        moves.push([nr, nc]);
      } else if (
        (isRed(piece)   && isBlack(neighbor)) ||
        (isBlack(piece) && isRed(neighbor))
      ) {
        // Check if landing square is free
        const lr = nr + dr, lc = nc + dc;
        if (inBounds(lr, lc) && board[lr][lc] === EMPTY) {
          jumps.push([lr, lc, nr, nc]); // land, jumped piece coords
        }
      }
    }

    return { moves, jumps };
  }

  // Get all possible jump sequences from (r, c) on a given board state
  // Returns array of jump paths: each path is [[r,c], [r,c], ...]
  function getJumpChains(board, r, c, visited = new Set()) {
    const key = `${r},${c}`;
    visited.add(key);
    const { jumps } = getPieceMoves(board, r, c);
    const result = [];

    for (const [lr, lc, jr, jc] of jumps) {
      const jumpKey = `${jr},${jc}`;
      if (visited.has(jumpKey)) continue;

      // Simulate the jump
      const nb = board.map(row => row.slice());
      nb[lr][lc] = nb[r][c];
      nb[r][c] = EMPTY;
      nb[jr][jc] = EMPTY;

      // Promote if needed
      if (nb[lr][lc] === RED && lr === 0) nb[lr][lc] = RED_K;
      if (nb[lr][lc] === BLACK && lr === 7) nb[lr][lc] = BLACK_K;

      const further = getJumpChains(nb, lr, lc, new Set([...visited, jumpKey]));
      if (further.length === 0) {
        result.push([[lr, lc]]);
      } else {
        further.forEach(chain => result.push([[lr, lc], ...chain]));
      }
    }
    return result;
  }

  // Flatten jump chains to just first-step destinations with capture metadata
  function getJumpDestinations(board, r, c) {
    const { jumps } = getPieceMoves(board, r, c);
    return jumps.map(([lr, lc, jr, jc]) => ({ land: [lr, lc], over: [jr, jc] }));
  }

  // Build initial checkers board
  function buildInitialBoard() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 !== 0) b[r][c] = BLACK;
      }
    }
    for (let r = 5; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 !== 0) b[r][c] = RED;
      }
    }
    return b;
  }

  function renderBoard(container, socket, room, myUserId) {
    const STYLE_ID = 'checkers-game-styles';
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .ck-wrap {
          max-width: 580px;
          margin: 0 auto;
          padding: 0 8px;
          font-family: inherit;
          color: var(--text);
        }
        .ck-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .ck-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0;
          color: #f0c244;
          text-shadow: 0 0 8px rgba(240,194,68,0.4);
        }
        .ck-turn-badge {
          font-size: 0.82rem;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 600;
          background: rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.15);
          color: #b0bec5;
        }
        .ck-turn-badge.my-turn {
          background: #2e7d32;
          color: #fff;
          border-color: #4ade80;
          box-shadow: 0 0 10px rgba(74,222,128,0.4);
          animation: ck-pulse 1.4s ease-in-out infinite;
        }
        @keyframes ck-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.72; }
        }
        .ck-players {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          gap: 6px;
        }
        .ck-player-card {
          flex: 1;
          background: rgba(0,0,0,0.45);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 0.82rem;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ck-player-card .ck-player-top {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ck-player-card.active-player {
          border-color: #4ade80;
          background: rgba(74,222,128,0.08);
          box-shadow: 0 0 12px rgba(74,222,128,0.25);
        }
        .ck-color-swatch {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 1.5px solid rgba(255,255,255,0.2);
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }
        /* Casino table wrapper for the board */
        .ck-board-table {
          background: radial-gradient(ellipse at center, #1a6b3a 0%, #0d4a27 60%, #083318 100%);
          border: 8px solid #5c3a1e;
          border-radius: 12px;
          box-shadow:
            inset 0 0 40px rgba(0,0,0,0.4),
            0 8px 32px rgba(0,0,0,0.6),
            0 0 0 2px #3d2510;
          padding: 10px;
          margin-bottom: 10px;
        }
        .ck-board-outer {
          position: relative;
          width: 100%;
          padding-bottom: 100%;
          margin: 0 auto;
        }
        .ck-board-inner {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          grid-template-rows: repeat(8, 1fr);
          border: 3px solid #3d2510;
          border-radius: 4px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px #8b6914,
            0 6px 32px rgba(0,0,0,0.5);
        }
        .ck-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          user-select: none;
          -webkit-user-select: none;
        }
        .ck-cell.light { background: #f0d9b5; }
        .ck-cell.dark  {
          background: #8B4513;
          cursor: pointer;
          transition: filter 0.1s;
        }
        .ck-cell.dark:hover { filter: brightness(1.18); }
        .ck-cell.can-land::after {
          content: '';
          position: absolute;
          width: 32%;
          height: 32%;
          border-radius: 50%;
          background: rgba(255,255,255,0.35);
          pointer-events: none;
          z-index: 1;
        }
        .ck-cell.can-jump::after {
          content: '';
          position: absolute;
          width: 32%;
          height: 32%;
          border-radius: 50%;
          background: rgba(239,68,68,0.65);
          pointer-events: none;
          z-index: 1;
        }
        .ck-piece {
          position: relative;
          z-index: 2;
          width: 72%;
          height: 72%;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(9px, 2vw, 16px);
          font-weight: 900;
          transition: transform 0.12s, box-shadow 0.12s;
          cursor: pointer;
          box-sizing: border-box;
        }
        .ck-piece.red-piece {
          background: radial-gradient(circle at 35% 35%, #ef5350, #b71c1c);
          border: 3px solid #7f0000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 3px rgba(255,255,255,0.25);
          color: rgba(255,255,255,0.9);
        }
        .ck-piece.black-piece {
          background: radial-gradient(circle at 35% 35%, #546e7a, #263238);
          border: 3px solid #000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 3px rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.85);
        }
        .ck-piece.is-king {
          font-size: clamp(10px, 2.2vw, 18px);
          text-shadow: 0 1px 3px rgba(0,0,0,0.7);
        }
        .ck-piece.red-piece.is-king {
          box-shadow: 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 3px rgba(255,255,255,0.25), 0 0 0 2px #f0c244;
        }
        .ck-piece.black-piece.is-king {
          box-shadow: 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 3px rgba(255,255,255,0.12), 0 0 0 2px #f0c244;
        }
        .ck-cell.selected .ck-piece {
          transform: scale(1.16);
          box-shadow: 0 0 0 3px #f0c244, 0 0 12px rgba(240,194,68,0.5), 0 4px 10px rgba(0,0,0,0.5);
        }
        .ck-cell.must-jump .ck-piece {
          box-shadow: 0 0 0 3px #ef4444, 0 0 10px rgba(239,68,68,0.5), 0 2px 6px rgba(0,0,0,0.45);
          animation: ck-must-jump 1.2s ease-in-out infinite;
        }
        @keyframes ck-must-jump {
          0%, 100% { box-shadow: 0 0 0 3px #ef4444, 0 0 10px rgba(239,68,68,0.5), 0 2px 6px rgba(0,0,0,0.45); }
          50% { box-shadow: 0 0 0 4px #ef4444, 0 0 18px rgba(239,68,68,0.7), 0 2px 6px rgba(0,0,0,0.45); }
        }
        .ck-status {
          text-align: center;
          font-size: 0.85rem;
          color: #78909c;
          background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 6px 12px;
        }
        .ck-status.finished {
          font-size: 1.05rem;
          font-weight: 700;
          color: #f0c244;
          padding: 10px;
          background: rgba(0,0,0,0.45);
          border: 1px solid rgba(240,194,68,0.4);
          border-radius: 8px;
          margin-top: 6px;
          text-shadow: 0 0 8px rgba(240,194,68,0.5);
        }
        .ck-counts {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          color: #78909c;
          margin-bottom: 6px;
          padding: 0 2px;
        }
        .ck-count-val {
          font-weight: 700;
          color: #e8e0d0;
        }
      `;
      document.head.appendChild(style);
    }

    // Determine my color: room creator plays red (index 0)
    const myColor = room.players[0] && room.players[0].userId === myUserId ? 'red' : 'black';
    let state = normalizeCheckersState(room.gameState || room.state);
    let board = state.board ? state.board.map(r => r.slice()) : buildInitialBoard();
    let turn  = state.turn || 'red';
    let gameStatus = state.status || 'playing';

    let selected = null;      // [r, c]
    let legalDests = [];      // [r, c] for simple moves
    let jumpDests  = [];      // { land: [r,c], over: [r,c] }
    let mustJumpPieces = [];  // [[r,c]] pieces that must jump
    let inMultiJump = false;  // currently mid-sequence

    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'ck-wrap';

    wrap.innerHTML = `
      <div class="ck-header">
        <h2 class="ck-title">🔴 Checkers</h2>
        <div class="ck-turn-badge" id="ck-turn-badge">Loading…</div>
      </div>
      <div class="ck-players" id="ck-players"></div>
      <div class="ck-counts" id="ck-counts"></div>
      <div class="ck-board-table">
        <div class="ck-board-outer">
          <div class="ck-board-inner" id="ck-board"></div>
        </div>
      </div>
      <div class="ck-status" id="ck-status"></div>
    `;
    container.appendChild(wrap);

    const boardEl   = document.getElementById('ck-board');
    const turnBadge = document.getElementById('ck-turn-badge');
    const playersEl = document.getElementById('ck-players');
    const countsEl  = document.getElementById('ck-counts');
    const statusEl  = document.getElementById('ck-status');

    const cells = [];

    for (let r = 0; r < 8; r++) {
      cells[r] = [];
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement('div');
        const isLight = (r + c) % 2 === 0;
        cell.className = 'ck-cell ' + (isLight ? 'light' : 'dark');
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (!isLight) cell.addEventListener('click', () => handleCellClick(r, c));
        boardEl.appendChild(cell);
        cells[r][c] = cell;
      }
    }

    function computeMustJump(color) {
      const pieces = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (belongsTo(board[r][c], color)) {
            const { jumps } = getPieceMoves(board, r, c);
            if (jumps.length > 0) pieces.push([r, c]);
          }
        }
      }
      return pieces;
    }

    function renderPieces() {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = cells[r][c];
          const existing = cell.querySelector('.ck-piece');
          if (existing) existing.remove();
          const val = board[r][c];
          if (val === EMPTY) continue;

          const piece = document.createElement('div');
          const kingClass = isKing(val) ? ' is-king' : '';
          piece.className = 'ck-piece ' + (isRed(val) ? 'red-piece' : 'black-piece') + kingClass;
          if (isKing(val)) piece.textContent = '♛';
          cell.appendChild(piece);
        }
      }
    }

    function renderHighlights() {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = cells[r][c];
          cell.classList.remove('selected', 'can-land', 'can-jump', 'must-jump');
        }
      }

      // Show must-jump glow on pieces that have to jump
      if (turn === myColor && gameStatus === 'playing') {
        mustJumpPieces.forEach(([r, c]) => {
          if (cells[r] && cells[r][c]) cells[r][c].classList.add('must-jump');
        });
      }

      if (selected) {
        const [sr, sc] = selected;
        if (cells[sr] && cells[sr][sc]) cells[sr][sc].classList.add('selected');

        jumpDests.forEach(({ land: [lr, lc] }) => {
          if (cells[lr] && cells[lr][lc]) cells[lr][lc].classList.add('can-jump');
        });

        if (jumpDests.length === 0) {
          legalDests.forEach(([lr, lc]) => {
            if (cells[lr] && cells[lr][lc]) cells[lr][lc].classList.add('can-land');
          });
        }
      }
    }

    function renderTurnInfo() {
      const isMyTurn = turn === myColor && gameStatus === 'playing';
      let label;
      if (gameStatus !== 'playing') {
        label = gameStatus === 'finished' ? 'Game Over' : gameStatus;
      } else {
        label = isMyTurn ? 'Your turn' : `${turn.charAt(0).toUpperCase() + turn.slice(1)}'s turn`;
      }
      turnBadge.textContent = label;
      turnBadge.className = 'ck-turn-badge' + (isMyTurn ? ' my-turn' : '');
    }

    function renderPlayers() {
      const red   = room.players[0];
      const black = room.players[1];
      const rActive = turn === 'red' && gameStatus === 'playing';
      const bActive = turn === 'black' && gameStatus === 'playing';
      playersEl.innerHTML = `
        <div class="ck-player-card${rActive ? ' active-player' : ''}">
          <div class="ck-player-top">
            <div class="ck-color-swatch" style="background:radial-gradient(circle at 35% 35%,#ef5350,#b71c1c)"></div>
            <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e8e0d0">${red ? red.username : 'Waiting…'}</span>
            ${red && red.userId === myUserId ? '<span style="font-size:0.7rem;color:#78909c">(you)</span>' : ''}
            ${rActive ? '<span style="margin-left:auto;font-size:0.7rem;color:#4ade80;font-weight:700">▶ turn</span>' : ''}
          </div>
        </div>
        <div style="align-self:center;font-size:0.8rem;color:#546e7a;flex-shrink:0;font-weight:700">VS</div>
        <div class="ck-player-card${bActive ? ' active-player' : ''}">
          <div class="ck-player-top">
            <div class="ck-color-swatch" style="background:radial-gradient(circle at 35% 35%,#546e7a,#263238)"></div>
            <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e8e0d0">${black ? black.username : 'Waiting…'}</span>
            ${black && black.userId === myUserId ? '<span style="font-size:0.7rem;color:#78909c">(you)</span>' : ''}
            ${bActive ? '<span style="margin-left:auto;font-size:0.7rem;color:#4ade80;font-weight:700">▶ turn</span>' : ''}
          </div>
        </div>
      `;
    }

    function renderCounts() {
      let redCount = 0, blackCount = 0;
      board.flat().forEach(v => {
        if (isRed(v)) redCount++;
        else if (isBlack(v)) blackCount++;
      });
      countsEl.innerHTML = `
        <span style="color:#ef5350">Red: <span class="ck-count-val">${redCount}</span></span>
        <span style="color:var(--text-dim)">pieces</span>
        <span style="color:var(--text-dim)">Black: <span class="ck-count-val">${blackCount}</span></span>
      `;
    }

    function renderStatus() {
      if (gameStatus === 'playing') {
        if (inMultiJump) {
          statusEl.className = 'ck-status';
          statusEl.textContent = 'Multi-jump! Continue jumping with the same piece.';
        } else if (selected) {
          statusEl.className = 'ck-status';
          const hasJump = jumpDests.length > 0;
          statusEl.textContent = hasJump
            ? 'Jump available — click highlighted square'
            : 'Click highlighted square to move';
        } else if (turn === myColor) {
          statusEl.className = 'ck-status';
          statusEl.textContent = mustJumpPieces.length > 0
            ? 'You must jump! Select a highlighted piece.'
            : 'Select a piece to move.';
        } else {
          statusEl.className = 'ck-status';
          statusEl.textContent = `Waiting for opponent…`;
        }
      } else if (gameStatus === 'finished' || gameStatus === 'checkmate') {
        statusEl.className = 'ck-status finished';
        statusEl.textContent = `Game over! ${turn === 'red' ? 'Black' : 'Red'} wins!`;
      } else if (gameStatus === 'waiting') {
        statusEl.className = 'ck-status';
        statusEl.textContent = 'Waiting for opponent to join…';
      }
    }

    function fullRender() {
      mustJumpPieces = computeMustJump(turn);
      renderPieces();
      renderHighlights();
      renderTurnInfo();
      renderPlayers();
      renderCounts();
      renderStatus();
    }

    function handleCellClick(r, c) {
      if (gameStatus !== 'playing') return;
      if (turn !== myColor) {
        UI.toast("It's not your turn", 'loss');
        return;
      }

      const val = board[r][c];

      // ---- clicking on a destination ----
      if (selected) {
        const [sr, sc] = selected;

        // Clicked the selected piece itself — deselect (only if not mid-jump)
        if (sr === r && sc === c) {
          if (!inMultiJump) {
            selected = null;
            legalDests = [];
            jumpDests = [];
            renderHighlights();
            renderStatus();
          }
          return;
        }

        // Clicked a jump destination?
        const jumpTarget = jumpDests.find(({ land: [lr, lc] }) => lr === r && lc === c);
        if (jumpTarget) {
          executeJump(sr, sc, r, c, jumpTarget.over);
          return;
        }

        // Clicked a simple move destination (only if no jumps forced)
        if (!inMultiJump) {
          const isSimpleDest = legalDests.some(([lr, lc]) => lr === r && lc === c);
          if (isSimpleDest && mustJumpPieces.length === 0) {
            executeMove(sr, sc, r, c);
            return;
          }
        }

        // Clicked a different own piece (re-select), unless mid-jump
        if (!inMultiJump && belongsTo(val, myColor)) {
          selectPiece(r, c);
          return;
        }

        // Invalid click
        return;
      }

      // ---- no piece selected yet ----
      if (!val || !belongsTo(val, myColor)) return;

      // If there are forced jumps, only allow selecting those pieces
      if (mustJumpPieces.length > 0) {
        const isMustJump = mustJumpPieces.some(([mr, mc]) => mr === r && mc === c);
        if (!isMustJump) {
          UI.toast('You must jump with a different piece!', 'loss');
          return;
        }
      }

      selectPiece(r, c);
    }

    function selectPiece(r, c) {
      selected = [r, c];
      const { moves, jumps } = getPieceMoves(board, r, c);
      // jumps take priority — if any jumps exist, only show jumps
      jumpDests  = jumps.map(([lr, lc, jr, jc]) => ({ land: [lr, lc], over: [jr, jc] }));
      legalDests = jumpDests.length === 0 ? moves : [];
      renderHighlights();
      renderStatus();
    }

    function applyMove(fr, fc, tr, tc) {
      board[tr][tc] = board[fr][fc];
      board[fr][fc] = EMPTY;
      // Kinging
      if (board[tr][tc] === RED && tr === 0)   board[tr][tc] = RED_K;
      if (board[tr][tc] === BLACK && tr === 7)  board[tr][tc] = BLACK_K;
    }

    function executeMove(fr, fc, tr, tc) {
      // Optimistic update
      applyMove(fr, fc, tr, tc);
      turn = turn === 'red' ? 'black' : 'red';
      selected = null;
      legalDests = [];
      jumpDests = [];
      inMultiJump = false;
      fullRender();

      socket.emit('bg:move', {
        roomId: room.id,
        move: { from: [fr, fc], to: [tr, tc] },
      });
    }

    function executeJump(fr, fc, tr, tc, [jr, jc]) {
      // Apply jump
      board[tr][tc] = board[fr][fc];
      board[fr][fc] = EMPTY;
      board[jr][jc] = EMPTY;
      // Kinging
      if (board[tr][tc] === RED && tr === 0)   board[tr][tc] = RED_K;
      if (board[tr][tc] === BLACK && tr === 7)  board[tr][tc] = BLACK_K;

      // Emit the move
      socket.emit('bg:move', {
        roomId: room.id,
        move: { from: [fr, fc], to: [tr, tc] },
      });

      // Check for further jumps from landing square
      const { jumps: furtherJumps } = getPieceMoves(board, tr, tc);
      // Only continue multi-jump if the piece wasn't just kinged (kings can't continue in standard rules)
      const justKinged = (board[tr][tc] === RED_K && board[tr][tc] !== board[fr][fc]) ||
                         (board[tr][tc] === BLACK_K && board[tr][tc] !== board[fr][fc]);

      if (furtherJumps.length > 0 && !justKinged) {
        inMultiJump = true;
        selected = [tr, tc];
        jumpDests  = furtherJumps.map(([lr, lc, jjr, jjc]) => ({ land: [lr, lc], over: [jjr, jjc] }));
        legalDests = [];
        mustJumpPieces = [[tr, tc]];
        renderPieces();
        renderHighlights();
        renderTurnInfo();
        renderCounts();
        renderStatus();
      } else {
        inMultiJump = false;
        selected = null;
        legalDests = [];
        jumpDests = [];
        turn = turn === 'red' ? 'black' : 'red';
        fullRender();
      }
    }

    // Socket events
    socket.on('bg:room-update', (updatedRoom) => {
      if (updatedRoom.id !== room.id) return;
      const s = normalizeCheckersState(updatedRoom.gameState || updatedRoom.state);
      if (s.board) board = s.board.map(r => r.slice());
      if (s.turn !== undefined) turn = s.turn;
      if (s.status) gameStatus = s.status;
      if (updatedRoom.players) room.players = updatedRoom.players;
      selected = null;
      legalDests = [];
      jumpDests = [];
      inMultiJump = false;
      fullRender();
    });

    socket.on('bg:error', (msg) => {
      UI.toast(msg || 'Move error', 'loss');
      selected = null;
      legalDests = [];
      jumpDests = [];
      inMultiJump = false;
      renderHighlights();
      renderStatus();
    });

    // Initial render
    fullRender();
  }

  return { renderBoard };
})();
