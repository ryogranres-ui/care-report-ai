// Care Report AI クライアント側ロジック

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("report-form");
  const generateBtn = document.getElementById("generate-btn");
  const outputArea = document.getElementById("report-output");

  const scoreNumberEl = document.getElementById("score-number");
  const scoreLevelEl = document.getElementById("score-level");
  const scoreCommentEl = document.getElementById("score-comment");

  if (!generateBtn) return;

  generateBtn.addEventListener("click", () => {
    // 入力値を取得
    const reporterName = getValue("reporter-name");
    const position = getValue("position");
    const what = getValue("what");
    const when = getValue("when");
    const where = getValue("where");
    const who = getValue("who");

    const bpSys = getValue("bp-sys");
    const bpDia = getValue("bp-dia");
    const pulse = getValue("pulse");
    const spo2 = getValue("spo2");
    const temp = getValue("temp");

    const state = getValue("state");
    const action = getValue("action");
    const goalKind = getValue("goal-kind");
    const goalDetail = getValue("goal-detail");

    // 報告文を組み立て
    const reportText = buildReportText({
      reporterName,
      position,
      what,
      when,
      where,
      who,
      bpSys,
      bpDia,
      pulse,
      spo2,
      temp,
      state,
      action,
      goalKind,
      goalDetail,
    });

    outputArea.value = reportText;

    // スコア計算
    const scoreResult = calcScore({
      what,
      when,
      where,
      who,
      state,
      bpSys,
      bpDia,
      pulse,
      spo2,
      temp,
      action,
      goalKind,
      goalDetail,
    });

    scoreNumberEl.textContent = String(scoreResult.score);

    const feedback = getScoreFeedback(scoreResult.score, scoreResult.missing);
    scoreLevelEl.textContent = `レベル：${feedback.levelLabel}`;
    scoreCommentEl.textContent = feedback.comment;
  });
});

/**
 * 指定 ID の value をトリムして取得
 */
function getValue(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  return (el.value || "").trim();
}

/**
 * 報告文生成
 */
function buildReportText(data) {
  const lines = [];

  const reporterPart = (() => {
    const name = data.reporterName;
    const pos = data.position;
    if (!name && !pos) return "";
    if (name && pos) return `報告者：${name}（${pos}）`;
    if (name) return `報告者：${name}`;
    if (pos) return `報告者：${pos}`;
    return "";
  })();

  if (reporterPart) {
    lines.push(`● ${reporterPart}`);
  }

  if (data.when || data.where) {
    lines.push(`● 発生日時・場所：${fallback(data.when)}　／　${fallback(data.where)}`);
  }

  if (data.who) {
    lines.push(`● 対象者：${data.who}`);
  }

  if (data.what) {
    lines.push(`● 何が起きたか：${data.what}`);
  }

  // 状態・バイタル
  const vitalParts = [];
  if (data.bpSys || data.bpDia) {
    vitalParts.push(`血圧 ${fallback(data.bpSys)} / ${fallback(data.bpDia)} mmHg`);
  }
  if (data.pulse) {
    vitalParts.push(`脈拍 ${data.pulse} 回/分`);
  }
  if (data.spo2) {
    vitalParts.push(`SpO₂ ${data.spo2} %`);
  }
  if (data.temp) {
    vitalParts.push(`体温 ${data.temp} ℃`);
  }

  let stateLine = "";
  if (data.state) {
    stateLine += data.state.trim();
    if (vitalParts.length > 0) {
      stateLine += " バイタルは、" + vitalParts.join("、") + " です。";
    }
  } else if (vitalParts.length > 0) {
    stateLine = "バイタルは、" + vitalParts.join("、") + " です。";
  }

  if (stateLine) {
    lines.push(`● 現在の状態：${stateLine}`);
  }

  if (data.action) {
    lines.push(`● あなたの対応：${data.action}`);
  }

  if (data.goalKind || data.goalDetail) {
    const goalMain = data.goalKind ? `【${data.goalKind}】` : "";
    const goalText = data.goalDetail || "";
    lines.push(`● 相手にお願いしたいこと：${goalMain} ${goalText}`.trim());
  }

  return lines.join("\n");
}

function fallback(value, alt = "―") {
  return value && value.trim() ? value.trim() : alt;
}

/**
 * スコア計算
 * ざっくり「7要素がどれくらい埋まっているか」を見る簡易ロジック
 */
function calcScore(fields) {
  let score = 0;
  const missing = [];

  // それぞれ 0〜15 点（最大 105 点 → 100 点に丸め）
  if (hasText(fields.what)) score += 15;
  else missing.push("何が起きたか");

  if (hasText(fields.when)) score += 15;
  else missing.push("いつ");

  if (hasText(fields.where)) score += 15;
  else missing.push("どこで");

  if (hasText(fields.who)) score += 15;
  else missing.push("誰が");

  // 状態＋バイタル
  const hasStateText = hasText(fields.state);
  const hasAnyVital = [fields.bpSys, fields.bpDia, fields.pulse, fields.spo2, fields.temp].some(
    hasText
  );

  if (hasStateText && hasAnyVital) {
    score += 15; // 状態 + バイタルそろっている
  } else if (hasStateText || hasAnyVital) {
    score += 8; // どちらかだけ
    missing.push("状態・バイタルのどちらか");
  } else {
    missing.push("状態・バイタル");
  }

  if (hasText(fields.action)) score += 15;
  else missing.push("あなたの対応");

  const hasGoalText = hasText(fields.goalKind) || hasText(fields.goalDetail);
  if (hasGoalText) score += 15;
  else missing.push("報告のゴール");

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return { score: finalScore, missing };
}

function hasText(value) {
  return value != null && String(value).trim().length > 0;
}

/**
 * スコアに応じたレベル・コメント生成
 */
function getScoreFeedback(score, missingItems) {
  let levelLabel;
  let baseComment;

  if (score >= 90) {
    levelLabel = "Lv.3 ほぼ完成形の報告";
    baseComment =
      "主要な情報がしっかり揃っていて、とても伝わりやすい報告です。このまま現場でも通用するレベルです。";
  } else if (score >= 70) {
    levelLabel = "Lv.2 要点は押さえられている";
    baseComment =
      "大事なポイントは概ね書けています。時間・場所・状態・ゴールのどこかを、もう一文だけ具体的にするとさらに良くなります。";
  } else {
    levelLabel = "Lv.1 まずは型になれる段階";
    baseComment =
      "まだ情報が足りない部分があります。「何が・いつ・どこで・誰に」を意識して、一文ずつ埋めていく練習をしていきましょう。";
  }

  let missingPart = "";
  if (Array.isArray(missingItems) && missingItems.length > 0) {
    const top3 = missingItems.slice(0, 3); // 多すぎると読みにくいので最大3件
    missingPart =
      "\n\n今回特に弱かった項目： " +
      top3.join("・") +
      "。\n次に報告を書くときは、ここを意識して1〜2文だけ足してみましょう。";
  }

  return {
    levelLabel,
    comment: baseComment + missingPart,
  };
}
