/* Multilanguage "How to Play" modal — attach to any game page */
const HowToPlay = (() => {
  const LANGS = {
    en: "🇬🇧 EN",
    es: "🇪🇸 ES",
    fr: "🇫🇷 FR",
    de: "🇩🇪 DE",
    pt: "🇧🇷 PT",
    ru: "🇷🇺 RU",
    zh: "🇨🇳 ZH",
    ja: "🇯🇵 JA",
  };

  const GUIDES = {
    crash: {
      en: { title: "Crash", steps: ["Set your bet amount and optional auto cashout multiplier.", "Click 'Bet' before the round starts.", "The multiplier climbs — cash out before it crashes!", "If you don't cash out before the crash you lose your bet."] },
      es: { title: "Crash", steps: ["Establece tu apuesta y un multiplicador de salida automático opcional.", "Haz clic en 'Apostar' antes de que comience la ronda.", "El multiplicador sube — ¡retira antes de que se rompa!", "Si no retiras antes del crash, pierdes tu apuesta."] },
      fr: { title: "Crash", steps: ["Définissez votre mise et un multiplicateur de cashout automatique optionnel.", "Cliquez sur 'Parier' avant le début du tour.", "Le multiplicateur monte — encaissez avant qu'il ne crashe !", "Si vous n'encaissez pas avant le crash, vous perdez votre mise."] },
      de: { title: "Crash", steps: ["Lege deinen Einsatz und optional einen Auto-Cashout-Multiplikator fest.", "Klicke vor Rundenstart auf 'Setzen'.", "Der Multiplikator steigt — cashe aus bevor er crasht!", "Wenn du vor dem Crash nicht auszahlst, verlierst du deinen Einsatz."] },
      pt: { title: "Crash", steps: ["Defina seu valor de aposta e um multiplicador de cashout automático opcional.", "Clique em 'Apostar' antes do início da rodada.", "O multiplicador sobe — retire antes que caia!", "Se não retirar antes do crash, você perde a aposta."] },
      ru: { title: "Краш", steps: ["Установите ставку и необязательный множитель автовывода.", "Нажмите «Ставка» до начала раунда.", "Множитель растёт — выведите деньги до краша!", "Если не вывести до краша — ставка потеряна."] },
      zh: { title: "崩溃", steps: ["设置投注金额和可选的自动提现倍数。", "在轮次开始前点击「投注」。", "倍数不断上升——在崩溃之前提现！", "如果在崩溃前未提现，您将损失赌注。"] },
      ja: { title: "クラッシュ", steps: ["賭け金と自動キャッシュアウト倍率を設定します。", "ラウンド開始前に「ベット」をクリック。", "倍率が上昇中にキャッシュアウト！", "クラッシュ前にキャッシュアウトしないと賭け金を失います。"] },
    },
    dice: {
      en: { title: "Dice", steps: ["Set bet amount.", "Choose Roll Over or Roll Under and set your target number (0–99).", "Click Roll — if the result beats your target you win!", "Lower targets = higher multiplier but lower win chance."] },
      es: { title: "Dados", steps: ["Establece el monto de tu apuesta.", "Elige Sobre o Bajo y el número objetivo (0–99).", "Haz clic en Tirar — ¡si el resultado supera tu objetivo ganas!", "Objetivos más bajos = mayor multiplicador pero menor probabilidad."] },
      fr: { title: "Dés", steps: ["Définissez votre mise.", "Choisissez Au-dessus ou En-dessous et fixez votre cible (0–99).", "Cliquez sur Lancer — si le résultat dépasse votre cible, vous gagnez !", "Cibles basses = multiplicateur élevé mais faible probabilité."] },
      de: { title: "Würfel", steps: ["Setze deinen Einsatz.", "Wähle Drüber oder Drunter und gib deine Zielzahl ein (0–99).", "Klicke auf Würfeln — wenn das Ergebnis dein Ziel schlägt, gewinnst du!", "Niedrigere Ziele = höherer Multiplikator, geringere Gewinnchance."] },
      pt: { title: "Dados", steps: ["Defina o valor da aposta.", "Escolha Acima ou Abaixo e defina seu número alvo (0–99).", "Clique em Rolar — se o resultado bater seu alvo, você ganha!", "Alvos menores = maior multiplicador, mas menor chance."] },
      ru: { title: "Кости", steps: ["Установите ставку.", "Выберите Выше или Ниже и задайте целевое число (0–99).", "Нажмите Бросить — если результат превышает цель, вы выигрываете!", "Низкие цели = высокий множитель, но меньше шансов."] },
      zh: { title: "骰子", steps: ["设置投注金额。", "选择「大于」或「小于」并设置目标数（0–99）。", "点击「掷骰」——如果结果超过目标，您就赢了！", "目标越低=倍数越高但获胜概率越低。"] },
      ja: { title: "ダイス", steps: ["賭け金を設定。", "「以上」か「以下」を選び目標数（0–99）を入力。", "「ロール」をクリック — 結果が目標を超えたら勝ち！", "低い目標 = 高い倍率、低い勝率。"] },
    },
    mines: {
      en: { title: "Mines", steps: ["Set bet amount and number of mines.", "Click 'Start' then reveal tiles.", "Each safe tile increases your multiplier.", "Click 'Cash Out' to lock in your winnings.", "Hit a mine and you lose everything!"] },
      es: { title: "Minas", steps: ["Establece el monto y número de minas.", "Haz clic en 'Iniciar' y revela celdas.", "Cada celda segura aumenta tu multiplicador.", "Haz clic en 'Cobrar' para asegurar tus ganancias.", "¡Pisa una mina y pierdes todo!"] },
      fr: { title: "Mines", steps: ["Définissez la mise et le nombre de mines.", "Cliquez sur 'Démarrer' puis révélez des cases.", "Chaque case sûre augmente votre multiplicateur.", "Cliquez sur 'Encaisser' pour sécuriser vos gains.", "Touchez une mine et vous perdez tout !"] },
      de: { title: "Minen", steps: ["Setze Einsatz und Anzahl der Minen.", "Klicke auf 'Start' und decke Felder auf.", "Jedes sichere Feld erhöht deinen Multiplikator.", "Klicke auf 'Auszahlen' um Gewinne zu sichern.", "Treffe eine Mine und verliere alles!"] },
      pt: { title: "Minas", steps: ["Defina a aposta e o número de minas.", "Clique em 'Iniciar' e revele células.", "Cada célula segura aumenta seu multiplicador.", "Clique em 'Sacar' para garantir seus ganhos.", "Acerte uma mina e perde tudo!"] },
      ru: { title: "Мины", steps: ["Установите ставку и количество мин.", "Нажмите «Старт» и открывайте клетки.", "Каждая безопасная клетка повышает множитель.", "Нажмите «Вывести» чтобы зафиксировать выигрыш.", "Попадёте на мину — потеряете всё!"] },
      zh: { title: "扫雷", steps: ["设置投注和地雷数量。", "点击「开始」然后翻开方块。", "每个安全方块增加倍数。", "点击「提现」锁定奖金。", "碰到地雷会失去一切！"] },
      ja: { title: "マインズ", steps: ["賭け金と地雷数を設定。", "「スタート」をクリックしてタイルを開く。", "安全なタイルごとに倍率アップ。", "「キャッシュアウト」で勝ち確定。", "地雷に当たると全損！"] },
    },
    jackpot: {
      en: { title: "Jackpot", steps: ["Enter any amount of chips into the pot.", "The more chips you put in, the higher your chance of winning.", "After 20 seconds of inactivity the jackpot spins.", "One winner takes 95% of the total pot!"] },
      es: { title: "Jackpot", steps: ["Introduce cualquier cantidad de fichas en el pozo.", "Cuantas más fichas pongas, mayor probabilidad de ganar.", "Después de 20 segundos de inactividad gira el jackpot.", "¡Un ganador se lleva el 95% del pozo total!"] },
      fr: { title: "Jackpot", steps: ["Mettez des jetons dans la cagnotte.", "Plus vous mettez, plus vos chances sont élevées.", "Après 20 secondes d'inactivité, le jackpot tourne.", "Un gagnant emporte 95% de la cagnotte !"] },
      de: { title: "Jackpot", steps: ["Setze beliebig viele Chips in den Topf.", "Je mehr du einsetzt, desto höher deine Gewinnchance.", "Nach 20 Sekunden Inaktivität dreht der Jackpot.", "Ein Gewinner bekommt 95% des gesamten Topfes!"] },
      pt: { title: "Jackpot", steps: ["Coloque qualquer quantidade de fichas no pote.", "Quanto mais fichas, maior a chance de ganhar.", "Após 20 segundos de inatividade o jackpot gira.", "Um vencedor leva 95% do pote total!"] },
      ru: { title: "Джекпот", steps: ["Поставьте любое количество фишек в банк.", "Чем больше поставите — тем выше шанс победы.", "Через 20 секунд без новых ставок — спин.", "Один победитель забирает 95% всего банка!"] },
      zh: { title: "大奖", steps: ["向奖池投入任意数量的筹码。", "投入越多，获胜概率越高。", "20秒无新投注后开始抽奖。", "一名获胜者获得95%的奖池！"] },
      ja: { title: "ジャックポット", steps: ["任意の枚数のチップをポットに入れる。", "多く入れるほど当選確率が上がります。", "20秒間入金がないと抽選開始。", "1人の勝者がポット総額の95%を獲得！"] },
    },
    horserace: {
      en: { title: "Horse Race", steps: ["Pick one of 6 horses — each has different odds.", "Bet before the gates close (15 seconds).", "The race runs automatically.", "If your horse wins, you get back bet × horse odds.", "Higher odds horses win less often but pay more."] },
      es: { title: "Carreras", steps: ["Elige uno de 6 caballos — cada uno tiene cuotas distintas.", "Apuesta antes de que cierren las puertas (15 segundos).", "La carrera se ejecuta automáticamente.", "Si tu caballo gana, cobras apuesta × cuota.", "Caballos con cuotas altas ganan menos seguido pero pagan más."] },
      fr: { title: "Course de chevaux", steps: ["Choisissez un des 6 chevaux, chacun avec des cotes différentes.", "Pariez avant la fermeture des portes (15s).", "La course se déroule automatiquement.", "Si votre cheval gagne, vous touchez mise × cotes.", "Les chevaux à fortes cotes gagnent moins souvent mais rapportent davantage."] },
      de: { title: "Pferderennen", steps: ["Wähle eines von 6 Pferden mit unterschiedlichen Quoten.", "Wette bevor die Tore schließen (15 Sekunden).", "Das Rennen läuft automatisch.", "Wenn dein Pferd gewinnt, erhältst du Einsatz × Quote.", "Pferde mit hohen Quoten gewinnen seltener, zahlen aber mehr."] },
      pt: { title: "Corrida de Cavalos", steps: ["Escolha um dos 6 cavalos — cada um tem odds diferentes.", "Aposte antes do fechamento dos portões (15 segundos).", "A corrida acontece automaticamente.", "Se seu cavalo vencer, você recebe aposta × odds.", "Cavalos com odds altas ganham menos mas pagam mais."] },
      ru: { title: "Скачки", steps: ["Выберите одну из 6 лошадей — у каждой свои коэффициенты.", "Ставьте до закрытия ворот (15 секунд).", "Гонка проходит автоматически.", "Если ваша лошадь победила — ставка × коэффициент.", "Лошади с высокими коэффициентами побеждают реже, но платят больше."] },
      zh: { title: "赛马", steps: ["从6匹马中选一匹——每匹马的赔率不同。", "在关门前下注（15秒）。", "比赛自动进行。", "您的马赢了，获得投注×赔率。", "高赔率的马获胜概率低但奖金高。"] },
      ja: { title: "競馬", steps: ["6頭の馬から1頭選ぶ — 各馬のオッズが異なります。", "ゲート閉鎖前（15秒）にベット。", "レースは自動的に行われます。", "選んだ馬が勝てばベット×オッズを獲得。", "高オッズの馬は勝ちにくいが配当が高い。"] },
    },
    rps: {
      en: { title: "Rock Paper Scissors", steps: ["Set your bet amount and click 'Find Match'.", "You'll be paired with someone betting the same amount.", "Choose Rock, Paper, or Scissors.", "Winner takes 95% of the combined pot!", "Tie = both players refunded."] },
      es: { title: "Piedra Papel Tijeras", steps: ["Establece tu apuesta y haz clic en 'Buscar Partida'.", "Se te emparejará con alguien con la misma apuesta.", "Elige Piedra, Papel o Tijeras.", "¡El ganador se lleva el 95% del pozo combinado!", "Empate = ambos jugadores recuperan su apuesta."] },
      fr: { title: "Pierre Feuille Ciseaux", steps: ["Fixez votre mise et cliquez sur 'Trouver un adversaire'.", "Vous serez associé à quelqu'un avec la même mise.", "Choisissez Pierre, Feuille ou Ciseaux.", "Le gagnant emporte 95% de la cagnotte combinée !", "Égalité = remboursement des deux joueurs."] },
      de: { title: "Schere Stein Papier", steps: ["Setze deinen Einsatz und klicke auf 'Gegner suchen'.", "Du wirst mit jemand mit gleichem Einsatz gepaart.", "Wähle Stein, Papier oder Schere.", "Der Gewinner bekommt 95% des kombinierten Topfes!", "Unentschieden = beide Spieler werden erstattet."] },
      pt: { title: "Pedra Papel Tesoura", steps: ["Defina sua aposta e clique em 'Encontrar Partida'.", "Você será emparelhado com alguém com a mesma aposta.", "Escolha Pedra, Papel ou Tesoura.", "O vencedor leva 95% do pote combinado!", "Empate = ambos os jogadores recebem reembolso."] },
      ru: { title: "Камень Ножницы Бумага", steps: ["Установите ставку и нажмите «Найти матч».", "Вас свяжут с игроком с той же ставкой.", "Выберите Камень, Ножницы или Бумагу.", "Победитель забирает 95% общего банка!", "Ничья = обоим возвращают ставки."] },
      zh: { title: "剪刀石头布", steps: ["设置赌注并点击「寻找对手」。", "您将与投注相同金额的玩家配对。", "选择石头、布或剪刀。", "获胜者获得合并奖池的95%！", "平局=两位玩家都退款。"] },
      ja: { title: "じゃんけん", steps: ["賭け金を設定して「対戦相手を探す」をクリック。", "同じ金額をベットした相手とマッチング。", "グー、チョキ、パーを選択。", "勝者が合計ポットの95%を獲得！", "あいこ = 両者返金。"] },
    },
    poker: {
      en: { title: "Poker (5-Card Draw)", steps: ["Select a table and buy in.", "You'll get 5 cards when 2+ players join.", "Click cards to discard them, then 'Draw Cards' to replace them.", "Best poker hand wins the pot (minus 5% house fee).", "Hands: Pair < Two Pair < Three of a Kind < Straight < Flush < Full House < Four of a Kind < Straight Flush."] },
      es: { title: "Póker (5 cartas)", steps: ["Selecciona una mesa y realiza el buy-in.", "Recibirás 5 cartas cuando 2+ jugadores se unan.", "Haz clic en cartas para descartarlas, luego 'Robar Cartas'.", "La mejor mano de póker gana el pozo.", "Manos: Par < Dos Pares < Trío < Escalera < Color < Full < Póker < Escalera Color."] },
      fr: { title: "Poker (5 cartes)", steps: ["Choisissez une table et achetez votre mise.", "Vous aurez 5 cartes quand 2+ joueurs rejoignent.", "Cliquez sur les cartes à défausser puis 'Piocher'.", "Meilleure main gagne la cagnotte.", "Mains: Paire < Double Paire < Brelan < Suite < Couleur < Full < Carré < Quinte Flush."] },
      de: { title: "Poker (5-Karten-Draw)", steps: ["Wähle einen Tisch und zahle den Buy-in.", "Du erhältst 5 Karten wenn 2+ Spieler beitreten.", "Klicke auf Karten um sie abzuwerfen, dann 'Karten ziehen'.", "Beste Pokerhand gewinnt den Topf.", "Hände: Paar < Zwei Paare < Drilling < Straße < Flush < Full House < Vierling < Straight Flush."] },
      pt: { title: "Poker (Troca de 5 cartas)", steps: ["Selecione uma mesa e faça o buy-in.", "Você recebe 5 cartas quando 2+ jogadores entrarem.", "Clique nas cartas para descartá-las, depois 'Comprar Cartas'.", "A melhor mão de poker ganha o pote.", "Mãos: Par < Dois Pares < Trinca < Sequência < Flush < Full < Quadra < Straight Flush."] },
      ru: { title: "Покер (5 карт)", steps: ["Выберите стол и внесите байин.", "Вы получите 5 карт, когда 2+ игроков войдут.", "Кликайте по картам для сброса, затем «Добрать карты».", "Лучшая рука выигрывает банк.", "Руки: Пара < Две пары < Тройка < Стрит < Флеш < Фулл-хаус < Каре < Стрит-флеш."] },
      zh: { title: "扑克（换牌）", steps: ["选择桌子并买入。", "2人以上入场后您将获得5张牌。", "点击要丢弃的牌，然后点击「换牌」。", "最好的牌型赢得奖池。", "牌型：对子<两对<三条<顺子<同花<葫芦<四条<同花顺。"] },
      ja: { title: "ポーカー（5枚交換）", steps: ["テーブルを選んでバイインします。", "2人以上が参加すると5枚のカードが配られます。", "捨てるカードをクリックして「カードを引く」。", "最も強い役がポットを獲得。", "役: ペア<2ペア<3カード<ストレート<フラッシュ<フルハウス<4カード<ストレートフラッシュ"] },
    },
  };

  // Add same-structure guides for remaining games
  const SIMPLE_GAMES = {
    battledice: { icon: "🎲", title: "Battle Dice", en: "Join a room and place your bet. When the timer ends all players roll a die. Highest roll wins the pot (minus 5% house fee). Up to 8 players per room." },
    raffle: { icon: "🎟️", title: "Raffle", en: "Buy tickets for 10 chips each. Every 5 minutes one ticket is drawn at random — the holder wins 95% of the ticket pool. More tickets = better odds." },
    bingo: { icon: "🎱", title: "Bingo", en: "Pay 50 chips to join. You get a 5×5 bingo card. Numbers are drawn every 3 seconds — first player to complete a row, column, or diagonal calls BINGO and wins!" },
    tower: { icon: "🗼", title: "Tower", en: "Bet any amount and start climbing the Tower. Each floor has a 20% chance of collapsing. Survive and multiply your winnings — cash out whenever you're happy." },
    multiroulette: { icon: "🎡", title: "Multi Roulette", en: "Everyone bets on the same spin every 30 seconds. Choose your bet type (Red/Black, Even/Odd, etc.) and amount. Wins pay based on the odds of your chosen type." },
    limbo: { icon: "📈", title: "Limbo", en: "Set a target multiplier and bet. A random multiplier is generated — if it's ≥ your target, you win bet × target. Lower target = safer, higher target = more risk." },
    plinko: { icon: "🔵", title: "Plinko", en: "Drop a ball into the plinko board. It bounces off pegs and lands in a slot. Higher risk = more extreme payouts. Watch out for the sides!" },
    keno: { icon: "🎯", title: "Keno", en: "Pick 1–10 numbers from 1–80. 20 numbers are drawn. The more of your picks that match, the higher your payout. Check the paytable for exact multipliers." },
    slots: { icon: "🎰", title: "Slots", en: "Set your bet per line and number of lines, then spin. Match symbols across active paylines to win. Bonus symbols trigger special features." },
    wheel: { icon: "🎡", title: "Wheel", en: "Choose a risk level (Low/Medium/High), set your bet, and spin the wheel. Higher risk = more segments are zero but big wins pay much more." },
    hilo: { icon: "↕️", title: "Hi-Lo", en: "A card is revealed. Bet on whether the next card will be Higher or Lower. Each correct prediction multiplies your winnings. Cash out anytime." },
    blackjack: { icon: "🃏", title: "Blackjack", en: "Try to get closer to 21 than the dealer without going over. Hit, Stand, Double Down, or Split. Dealer must hit on 16 and stand on 17+. Blackjack pays 1.5x." },
    baccarat: { icon: "🎴", title: "Baccarat", en: "Bet on Player, Banker, or Tie. Cards are dealt and totals compared — closest to 9 wins. Banker bets pay 0.95x, Tie pays 8x." },
    videopoker: { icon: "🃏", title: "Video Poker", en: "Place a bet, receive 5 cards, choose which to hold/discard, then draw. Payouts depend on your final poker hand. Aim for at least a pair of Jacks." },
    coinflip: { icon: "🪙", title: "Coinflip", en: "Create or join a 1v1 challenge. Both players bet the same amount. The coin is flipped using provably fair randomness. Winner takes 99% of the pot." },
    roulette: { icon: "🎡", title: "Roulette", en: "Place chips on the table — straight numbers, Red/Black, Even/Odd, Dozens, or Columns. The wheel spins (single zero). Straight-up pays 35:1, Red/Black/Even/Odd pays 1:1, Dozens/Columns pay 2:1." },
    cases: { icon: "📦", title: "Cases", en: "Buy a case to open it. Each case has a fixed pool of items with different rarities and chip values — rarer items are worth more but are less likely to drop. Open instantly and the item's value is added to your balance, or keep it in your inventory to trade." },
    scratch: { icon: "🎟️", title: "Scratch Cards", en: "Buy a scratch ticket and reveal its 3×3 grid one cell at a time. Match the required pattern of symbols to win the prize shown on the card. Each theme has different odds and top prizes." },
    arcade: { icon: "🕹️", title: "Arcade", en: "Pick any arcade machine — claw cranes, gacha capsules, ticket blasters, and more. Each costs a fixed number of chips to play and awards a randomly-selected prize from that machine's pool, with rarer prizes worth more chips." },
    boardgames: { icon: "♟️", title: "Board Games", en: "Pick a game (Chess, Checkers, Battleship, Durak, Wild Cards, Poker, Bridge, or Monopoly) and either create a room with your bet amount or join an open one. Once enough players join, the match starts automatically. Winner takes the pot minus a 5% house fee." },
    bg_chess: { icon: "♟️", title: "Board Games — Chess", en: "Standard chess rules: castling, en passant, and pawn promotion are all supported. Checkmate, stalemate, or resignation ends the game. Two players, turns alternate, winner takes the pot." },
    bg_checkers: { icon: "⚫", title: "Board Games — Checkers", en: "Standard checkers: diagonal moves only, jumps are forced when available, and pieces become kings on reaching the far row. Capture all of your opponent's pieces to win the pot." },
    bg_battleship: { icon: "🚢", title: "Board Games — Battleship", en: "Place your 5 ships on a hidden 10×10 grid, then take turns firing at your opponent's grid. Hits, misses, and sunk ships are revealed as you go. First to sink the entire enemy fleet wins." },
    bg_durak: { icon: "🃏", title: "Board Games — Durak", en: "Russian card game with a 36-card deck and a trump suit. The attacker plays cards; the defender beats each one with a higher card of the same suit or any trump, or picks up the whole table. Run out of cards before everyone else to avoid being the 'durak' (fool) and win." },
    bg_wildcards: { icon: "🎨", title: "Board Games — Wild Cards", en: "UNO-style game for 2–6 players. Match the top card by color or number, or play a Skip/Reverse/Draw 2/Wild card. First player to empty their hand wins the pot." },
    bg_poker: { icon: "♠️", title: "Board Games — Poker", en: "Texas Hold'em with blinds. Each player gets 2 hole cards; 5 community cards are revealed across the flop, turn, and river with a betting round each time. Best 5-card hand at showdown wins the pot." },
    bg_bridge: { icon: "🌉", title: "Board Games — Bridge", en: "Contract Bridge for exactly 4 players in two partnerships. Bid for a contract (level + suit), then the highest bidder's team tries to win that many tricks with their partner's hand on display. Meeting the contract wins the hand." },
    bg_monopoly: { icon: "🏠", title: "Board Games — Monopoly", en: "Classic board with all 40 squares, properties, railroads, and utilities. Roll dice, buy properties, collect rent, and bankrupt your opponents — or be the richest player when the round limit is reached." },
  };

  let currentLang = localStorage.getItem("casino_lang") || "en";
  let modal = null;

  function getLang() { return currentLang; }

  function getGuide(gameKey) {
    const full = GUIDES[gameKey];
    if (full) {
      const langData = full[currentLang] || full.en;
      return { title: langData.title, steps: langData.steps };
    }
    const simple = SIMPLE_GAMES[gameKey];
    if (simple) return { title: simple.title || gameKey, steps: [simple.en] };
    return null;
  }

  function showModal(gameKey) {
    if (modal) modal.remove();
    const guide = getGuide(gameKey);
    if (!guide) return;

    modal = document.createElement("div");
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0">❓ How to Play — ${guide.title}</h3>
          <button id="htp-close" style="background:none;border:none;color:var(--text-dim);font-size:1.4rem;cursor:pointer;line-height:1">×</button>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px">
          ${Object.entries(LANGS).map(([k, l]) => `<button class="lang-btn secondary-btn" data-lang="${k}" style="font-size:0.75rem;padding:4px 8px;${k === currentLang ? "border-color:var(--accent);color:var(--accent)" : ""}">${l}</button>`).join("")}
        </div>
        <ol id="htp-steps" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px;color:var(--text);font-size:0.9rem;line-height:1.5">
          ${guide.steps.map((s) => `<li>${s}</li>`).join("")}
        </ol>
      </div>`;

    modal.querySelector("#htp-close").addEventListener("click", () => { modal.remove(); modal = null; });
    modal.addEventListener("click", (e) => { if (e.target === modal) { modal.remove(); modal = null; } });

    modal.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentLang = btn.dataset.lang;
        localStorage.setItem("casino_lang", currentLang);
        showModal(gameKey);
      });
    });

    document.body.appendChild(modal);
  }

  function addButton(container, gameKey) {
    if (!getGuide(gameKey)) return;
    const btn = document.createElement("button");
    btn.className = "secondary-btn";
    btn.style.cssText = "font-size:0.75rem;padding:4px 10px;position:absolute;top:12px;right:12px;opacity:0.85;z-index:5";
    btn.textContent = "❓ How to Play";
    btn.addEventListener("click", () => showModal(gameKey));
    const panel = container.querySelector(".game-panel") || container.querySelector(".game-layout") || container;
    panel.style.position = "relative";
    panel.appendChild(btn);
  }

  return { showModal, addButton, getLang };
})();
