const form = document.getElementById("report-form");
const resultSection = document.getElementById("result-section");
const reportOutput = document.getElementById("report-output");
const scoreValue = document.getElementById("score-value");
const scoreLevel = document.getElementById("score-level");
const feedbackList = document.getElementById("feedback-list");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const level = document.getElementById("level").value;
  const title = document.getElementById("title").value.trim();
  const whenWhere = document.getElementById("whenWhere").value.trim();
  const whoWhat = document.getElementById("whoWhat").value.trim();
  const careAction = document.getElementById("careAction").value.trim();
  const currentStatus = document.getElementById("currentStatus").value.trim();
  const request = document.getElementById("request").value.trim();

  // ① 報告文をテンプレートから生成
  const lines = [];

  lines.push(`【件名】${title}`);
  lines.push("");
  lines.push("【報告者】");
  lines.push(`　立場：${level}`);
  lines.push("");
  lines.push("【いつ・どこで】");
  lines.push(`　${whenWhere || "（未入力）"}`);
  lines.push("");
  lines.push("【誰に・何が起きたか】");
  lines.push(`　${whoWhat || "（未入力）"}`);
  lines.push("");
  lines.push("【そのときの対応】");
  lines.push(`　${careAction || "（未入力）"}`);
  lines.push("");

  if (currentStatus) {
    lines.push("【現在の状態・変化】");
    lines.push(`　${currentStatus}`);
    lines.push("");
  }

  if (request) {
    lines.push("【相談したいこと・対応のお願い】");
    lines.push(`　${request}`);
    lines.push("");
  }

  lines.push("以上、ご確認をお願いいたします。");

  const reportText = lines.join("\n");
  reportOutput.value = reportText;

  // ② 簡易スコア計算（練習用）
  let score = 40;
  const feedback = [];

  const len = (text) => text.length;

  if (len(whenWhere) > 10) {
    score += 10;
  } else {
    feedback.push("・「いつ・どこで」の情報をもう少し具体的に書くとより伝わります。");
  }

  if (len(whoWhat) > 20) {
    score += 15;
  } else {
    feedback.push("・誰に何が起きたかを、主語をはっきりさせて書いてみましょう。");
  }

  if (len(careAction) > 25) {
    score += 20;
  } else {
    feedback.push("・あなたが行った対応を、順番に具体的に書くと評価が上がります。");
  }

  if (currentStatus) {
    score += 10;
  } else {
    feedback.push("・「今どうなっているか」があると、判断する人が安心しやすくなります。");
  }

  if (request) {
    score += 5;
  } else {
    feedback.push("・最後に「何をしてほしいのか」を一文で添えると、報告の目的が明確になります。");
  }

  if (score > 100) score = 100;

  scoreValue.textContent = score.toString();

  if (score >= 85) {
    scoreLevel.textContent = "とても分かりやすい報告です。この調子で続けましょう。";
  } else if (score >= 70) {
    scoreLevel.textContent = "概ね伝わっています。フィードバックを意識して少しだけブラッシュアップしてみましょう。";
  } else {
    scoreLevel.textContent =
      "大枠は伝わりますが、情報が抜けている可能性があります。下のフィードバックを参考に練習していきましょう。";
  }

  feedbackList.innerHTML = "";
  feedback.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    feedbackList.appendChild(li);
  });

  // 結果カードを表示
  resultSection.classList.remove("hidden");

  // 画面を結果までスクロール（使いやすさアップ）
  resultSection.scrollIntoView({ behavior: "smooth" });
});
