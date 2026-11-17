// =============================================
// 実験用サイトの動き
//   ① 選択画面で配色と文章を選ぶ
//   ② 「読み始める」を押すと時間を測り始める
//   ③ 「読み終わった」を押すと時間を止める
//   ④ 読了時間を表示する（実験者がアンケート用紙に書き写す）
// =============================================

// 画面に出す名前
const THEME_NAMES = { light: 'ライト', dark: 'ダーク' };
const TEXT_NAMES = { practice: '練習用の文章', A: '文章A', B: '文章B' };

let chosenTheme = '';  // 選んだ配色
let chosenText = '';   // 選んだ文章
let startTime = 0;     // 読み始めた時刻
let reading = false;   // 読んでいる途中かどうか

// 指定した画面だけを表示する
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (screen) {
    screen.hidden = (screen.id !== id);
  });
  window.scrollTo(0, 0);
}

// 文章を画面に入れる
function renderArticle(text) {
  const article = document.getElementById('article');
  article.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = text.title;
  article.appendChild(title);

  text.sections.forEach(function (section) {
    if (section.heading) {
      const h3 = document.createElement('h3');
      h3.textContent = section.heading;
      article.appendChild(h3);
    }
    section.paragraphs.forEach(function (paragraph) {
      const p = document.createElement('p');
      p.textContent = paragraph;
      article.appendChild(p);
    });
  });
}

// 秒を「○分○秒」にする（小数第1位まで）
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = (seconds - minutes * 60).toFixed(1);
  return minutes + '分' + rest + '秒';
}

// ① 選択画面：「この設定で準備する」
document.getElementById('go-button').addEventListener('click', function () {
  const theme = document.querySelector('input[name="theme"]:checked');
  const text = document.querySelector('input[name="text"]:checked');

  if (!theme || !text) {
    document.getElementById('select-error').hidden = false;
    return;
  }
  document.getElementById('select-error').hidden = true;

  chosenTheme = theme.value;
  chosenText = text.value;

  renderArticle(TEXTS[chosenText]);
  document.body.className = 'theme-' + chosenTheme; // ここから選んだ配色になる
  showScreen('start');
});

// ② 「読み始める」：時間を測り始める
document.getElementById('start-button').addEventListener('click', function () {
  showScreen('read');
  startTime = performance.now();
  reading = true;
});

// ③ 「読み終わった」：時間を止めて、結果を表示する
document.getElementById('finish-button').addEventListener('click', function () {
  if (!reading) return; // 2回押されても1回目だけ使う
  const seconds = (performance.now() - startTime) / 1000;
  reading = false;

  document.getElementById('result-theme').textContent = THEME_NAMES[chosenTheme];
  document.getElementById('result-text').textContent = TEXT_NAMES[chosenText];
  document.getElementById('result-time').textContent = formatTime(seconds);

  document.body.className = 'theme-neutral';
  showScreen('end');
});

// ④ 「選択画面に戻る」：次の配色の準備
document.getElementById('back-button').addEventListener('click', function () {
  document.querySelectorAll('input[type="radio"]').forEach(function (input) {
    input.checked = false;
  });
  showScreen('select');
});

// 読んでいる途中にページを閉じたり再読み込みしたりしようとしたら確認する
window.addEventListener('beforeunload', function (event) {
  if (reading) {
    event.preventDefault();
    event.returnValue = '';
  }
});
