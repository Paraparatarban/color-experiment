// =============================================
// 実験用サイトの動き（全員同時に行う形）
//   ① 参加者番号を入れると、配色と文章の順番が自動で決まる
//   ② 練習用の文章 → 1つ目 → 休憩 → 2つ目 の順に進む
//   ③ 「読み始める」から「読み終わった」までの時間を測って表示する
//      （どこにも送信・保存しない。紙の回答用紙なら参加者が書き写し、
//        Googleフォームを使うときは、フォームを開くときに自動で入る）
// =============================================

// Googleフォームの設定（フォーム作成.gs を実行したときのログの値を入れる）
//   url が空のときは、紙の回答用紙を使う形で動く
const FORM = {
  url: 'https://docs.google.com/forms/d/e/1FAIpQLSfBSVFevY2iczQ6LYTnMHQ1axx-tfsS2YNO6OeGpixhP6vCtw/viewform',
  entry: { number: 'entry.1287334433', timing: 'entry.1490269177', theme: 'entry.1304142283', time: 'entry.441100712', text: 'entry.689470594' },
};
const USE_FORM = FORM.url !== '';
const TIMINGS = ['読む前', '1つ目を読んだ後', '2つ目を読んだ後'];
const TIMING_REST = '休憩の後';

// フォームのURLに、番号などを自動で入れたものを作る
function formUrl(timing, c, seconds) {
  const q = ['usp=pp_url'];
  const add = function (key, value) { if (FORM.entry[key]) q.push(FORM.entry[key] + '=' + encodeURIComponent(value)); };
  add('number', participant);
  add('timing', timing);
  if (c) {
    add('theme', THEME_NAMES[c.theme]);
    add('text', TEXT_NAMES[c.text]);
    add('time', seconds.toFixed(1));
  }
  return FORM.url + '?' + q.join('&');
}

// 画面に出す名前
const THEME_NAMES = { light: 'ライト', dark: 'ダーク', neutral: '練習用' };
const TEXT_NAMES = { practice: '練習用の文章', A: '文章A', B: '文章B' };

// 参加者番号を4で割った余りで、配色と文章の順番を決める（実験計画の割り当て表と同じ）
//   余り1 → 組み合わせ1、2 → 2、3 → 3、0 → 4
const ORDERS = {
  1: [{ theme: 'light', text: 'A' }, { theme: 'dark', text: 'B' }],
  2: [{ theme: 'dark', text: 'A' }, { theme: 'light', text: 'B' }],
  3: [{ theme: 'light', text: 'B' }, { theme: 'dark', text: 'A' }],
  0: [{ theme: 'dark', text: 'B' }, { theme: 'light', text: 'A' }],
};

// 進み方（step）
//   0 = 練習、1 = 1つ目、2 = 2つ目
const STEPS = [
  {
    title: '練習用の文章',
    endTitle: '練習はおしまいです',
    guide: ['操作はこれだけです。練習の時間は書き写さなくてかまいません。',
            '回答用紙の1ページ目と2ページ目に答えてください。答え終わったら、下のボタンを押して1つ目の文章に進んでください。'],
    check: '回答用紙の1・2ページ目に答えた',
    next: '1つ目の文章へ進む',
  },
  {
    title: '1つ目の文章',
    endTitle: '1つ目はおしまいです',
    guide: ['回答用紙の3ページ目に、上の3つを書き写してください。続けて3ページ目の質問と、その文章の理解度問題に答えてください。',
            '答え終わったら下のボタンを押してください。10分の休憩になります。'],
    check: '3ページ目と理解度問題に答えた',
    next: '休憩を始める',
  },
  {
    title: '2つ目の文章',
    endTitle: '2つ目はおしまいです',
    guide: ['回答用紙の5ページ目に、上の3つを書き写してください。続けて5ページ目の質問と、その文章の理解度問題に答えてください。',
            '答え終わったら、回答用紙を裏返して手を挙げてください。お疲れさまでした。'],
    check: '',
    next: '',
  },
];

// Googleフォームを使うときの案内
const STEPS_FORM = [
  {
    guide: ['操作はこれだけです。',
            '下の「フォームを開く」を押して、基本情報と読む前の目の状態に答えてください。送信したらそのタブを閉じて（Ctrl＋W）、この画面に戻ってください。'],
    check: 'フォームを送信した',
  },
  {
    guide: ['下の「フォームを開く」を押して、目の状態・配色の見やすさ・理解度問題に答えてください。配色・文章・読了時間は自動で入っています。',
            '送信したらそのタブを閉じて、この画面に戻ってください。次は10分の休憩です。'],
    check: 'フォームを送信した',
  },
  {
    guide: ['下の「フォームを開く」を押して、目の状態・配色の見やすさ・理解度問題に答えてください。',
            '送信したらタブを閉じて、手を挙げてください。お疲れさまでした。'],
    check: '',
  },
];

const REST_MIN = 10;  // 休憩の長さ（分）
const REST_MAX = 20;  // これを過ぎたら点数に関係なく進んでよい（分）

let participant = 0;   // 参加者番号
let step = 0;          // 今どこか
let startTime = 0;     // 読み始めた時刻
let reading = false;   // 読んでいる途中かどうか
let restStart = 0;     // 休憩を始めた時刻（Date.now()、0なら休憩していない）
let restTimer = 0;
let showingResult = false; // 読了時間を表示している途中かどうか（書き写す前に閉じないように）

// 再読み込みしても番号と進み具合が消えないように、このタブの中だけに覚えておく
function save() {
  try { sessionStorage.setItem('experiment', JSON.stringify({ participant: participant, step: step, restStart: restStart })); } catch (e) {}
}
function load() {
  try { return JSON.parse(sessionStorage.getItem('experiment') || 'null'); } catch (e) { return null; }
}
function clearSaved() {
  try { sessionStorage.removeItem('experiment'); } catch (e) {}
}

// 今の step で読む配色と文章
function current() {
  if (step === 0) return { theme: 'neutral', text: 'practice' };
  return ORDERS[participant % 4][step - 1];
}

// 指定した画面だけを表示する
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (screen) {
    screen.hidden = (screen.id !== id);
  });
  // 実験者用の「最初からやり直す」は、文章を読む画面では出さない
  document.querySelector('.reset').hidden = (id === 'read');
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

// 読み始める前の画面を出す（ここで配色が変わる）
function showStart() {
  const c = current();
  renderArticle(TEXTS[c.text]);
  document.getElementById('start-title').textContent = STEPS[step].title;
  document.body.className = 'theme-' + c.theme;
  showScreen('start');
}

// ① 参加者番号
document.getElementById('number-button').addEventListener('click', function () {
  const n = parseInt(document.getElementById('number-input').value, 10);
  if (!(n >= 1 && n <= 99)) {
    document.getElementById('number-error').hidden = false;
    return;
  }
  document.getElementById('number-error').hidden = true;
  participant = n;
  document.getElementById('confirm-number').textContent = n;
  showScreen('confirm');
});

// ② 番号の確認
//（実験者用）タブを閉じてしまった人は、URLの最後に #1 か #2 を付けて開くと、
//  番号を入れた後に1つ目か2つ目の文章から始められる
document.getElementById('confirm-button').addEventListener('click', function () {
  step = ({ '#1': 1, '#2': 2 })[location.hash] || 0;
  restStart = 0;
  save();
  showStart();
});
document.getElementById('renumber-button').addEventListener('click', function () {
  showScreen('number');
});

// ③ 「読み始める」：時間を測り始める
document.getElementById('start-button').addEventListener('click', function () {
  showScreen('read');
  startTime = performance.now();
  reading = true;
});

// ④ 「読み終わった」：時間を止めて、結果を表示する
document.getElementById('finish-button').addEventListener('click', function () {
  if (!reading) return; // 2回押されても1回目だけ使う
  const seconds = (performance.now() - startTime) / 1000;
  reading = false;
  const c = current();
  const s = STEPS[step];

  document.getElementById('end-title').textContent = s.endTitle;
  document.getElementById('end-record').hidden = (step === 0);
  document.getElementById('result-theme').textContent = THEME_NAMES[c.theme];
  document.getElementById('result-text').textContent = TEXT_NAMES[c.text];
  document.getElementById('result-time').textContent = formatTime(seconds);

  const guide = document.getElementById('end-guide');
  guide.innerHTML = '';
  const lines = USE_FORM ? STEPS_FORM[step].guide : s.guide;
  document.getElementById('form-box').hidden = !USE_FORM;
  if (USE_FORM) {
    document.getElementById('form-link').href = formUrl(TIMINGS[step], step > 0 ? c : null, seconds);
    document.querySelector('#end-record .note').textContent = 'この3つはフォームに自動で入ります。念のため確認してください。';
  }
  lines.forEach(function (line) {
    const p = document.createElement('p');
    p.textContent = line;
    guide.appendChild(p);
  });

  const box = document.getElementById('next-box');
  box.hidden = (s.next === '');
  document.getElementById('next-check').checked = false;
  document.getElementById('next-check-label').textContent = USE_FORM ? STEPS_FORM[step].check : s.check;
  document.getElementById('next-button').textContent = s.next;
  document.getElementById('next-button').disabled = true;

  document.body.className = 'theme-neutral';
  showingResult = (step > 0);
  showScreen('end');
});

// ⑤ 次へ進む前のチェック
document.getElementById('next-check').addEventListener('change', function () {
  document.getElementById('next-button').disabled = !this.checked;
});
document.getElementById('next-button').addEventListener('click', function () {
  showingResult = false;
  if (step === 1) {
    restStart = Date.now();
    save();
    showRest();
    return;
  }
  step += 1;
  save();
  showStart();
});

// ⑥ 休憩：10分たつまでは進めない。20分たったら点数に関係なく進んでよい
function clock(ms) {
  const d = new Date(ms);
  return d.getHours() + '時' + String(d.getMinutes()).padStart(2, '0') + '分';
}
function showRest() {
  document.body.className = 'theme-neutral';
  document.getElementById('rest-end').textContent = clock(restStart + REST_MIN * 60000);
  document.getElementById('rest-max').textContent = clock(restStart + REST_MAX * 60000);
  document.getElementById('rest-max-form').textContent = clock(restStart + REST_MAX * 60000);
  document.getElementById('rest-paper').hidden = USE_FORM;
  document.getElementById('rest-form').hidden = !USE_FORM;
  if (USE_FORM) {
    document.getElementById('rest-wait-note').textContent = '時間になったら、この画面に出るボタンからフォームに答えてください。';
    document.getElementById('rest-form-link').href = formUrl(TIMING_REST, null, 0);
    document.getElementById('rest-check-label').textContent = 'フォームで「戻った」と答えた（または20分たった）';
  }
  document.getElementById('rest-check').checked = false;
  document.getElementById('rest-button').disabled = true;
  updateRest();
  clearInterval(restTimer);
  restTimer = setInterval(updateRest, 1000);
  showScreen('rest');
}
function updateRest() {
  const done = Date.now() - restStart >= REST_MIN * 60000;
  document.getElementById('rest-wait').hidden = done;
  document.getElementById('rest-done').hidden = !done;
  if (done) clearInterval(restTimer);
}
document.getElementById('rest-check').addEventListener('change', function () {
  document.getElementById('rest-button').disabled = !this.checked;
});
document.getElementById('rest-button').addEventListener('click', function () {
  restStart = 0;
  step = 2;
  save();
  showStart();
});

// 実験者用：最初からやり直す（2回押すと実行）
let resetArmed = false;
document.getElementById('reset-button').addEventListener('click', function () {
  if (!resetArmed) {
    resetArmed = true;
    this.textContent = 'もう一度押すと最初に戻ります';
    return;
  }
  clearSaved();
  location.reload();
});

// 読んでいる途中や、読了時間を書き写す前にページを閉じたり再読み込みしたりしようとしたら確認する
window.addEventListener('beforeunload', function (event) {
  if (reading || showingResult) {
    event.preventDefault();
    event.returnValue = '';
  }
});

// 再読み込みしたときは、覚えておいた番号と進み具合から続ける
//（読んでいる途中で再読み込みした場合は、その文章の「読み始める」からやり直しになる）
(function resume() {
  const saved = load();
  if (saved && saved.participant >= 1 && saved.step >= 0 && saved.step <= 2) {
    participant = saved.participant;
    step = saved.step;
    restStart = saved.restStart || 0;
    if (step === 1 && restStart) showRest();
    else showStart();
  }
})();
