/* -------------------------------------------------------
   DOM Utility
------------------------------------------------------- */
const el = (id) => document.getElementById(id);

/* -------------------------------------------------------
   DOM Elements
------------------------------------------------------- */
// Mode
const modeSelect = el("modeSelect");
const modeDescription = el("modeDescription");

// Inputs
const reporterNameInput = el("reporterName");
const userNameInput = el("userName");
const eventDateTimeInput = el("eventDateTime");
const eventPlaceInput = el("eventPlace");

const summaryInput = el("summary");
const detailsInput = el("details");
const actionsInput = el("actions");
const goalInput = el("goal");

const tempInput = el("tempInput");
const bpSysInput = el("bpSysInput");
const bpDiaInput = el("bpDiaInput");
const pulseInput = el("pulseInput");
const spo2Input = el("spo2Input");

const concernInput = el("concern");

const quickBulletsInput = el("quickBullets");
const btnQuickGenerate = el("btnQuickGenerate");
const quickTagButtons = document.querySelectorAll(".quick-tag");

// Output areas
const generatedReportEl = el("generatedReport");

const localScoreValueEl = el("localScoreValue");
const localScoreLevelEl = el("localScoreLevel");
const localScoreDetailEl = el("localScoreDetail");

const aiScoreValueEl = el("aiScoreValue");
const aiFeedbackEl = el("aiFeedback");
const aiRewriteEl = el("aiRewrite");

const aiRewriteCard = el("aiRewriteCard");
const aiRewriteText = el("aiRewriteText");

const aiShortCard = el("aiShortCard");
const aiShortText = el("aiShortText");

// Buttons
const btnGenerate = el("btnGenerate");
const btnEvaluate = el("btnEvaluate");
const btnCopyRewrite = el("btnCopyRewrite");
const btnApplyRewrite = el("btnApplyRewrite");
const btnCopyShort = el("btnCopyShort");

// Error
const errorMessageEl = el("errorMessage");

/* -------------------------------------------------------
   State
------------------------------------------------------- */
let currentInputMode = "normal";

/* -------------------------------------------------------
   Mode Configuration
------------------------------------------------------- */
const MODE_CONFIG = {
  report: {
    name: "共有・報告モード",
    description:
      "利用者の事故・状態変化・家族連絡などを、管理者や看護師に正確に伝える報告文を作成します。",
    labels: {
      summary: "概要（ひとことで言うと？）",
      details: "詳しい状況・経過",
      actions: "実施した対応",
      goal: "今後の対応・ゴール",
    },
    placeholders: {
      summary: "例）転倒はなかったが、ふらつきが強く危険を感じた。",
      details:
        "例）直前の様子 → 起きたこと → その後の反応\n時系列で書くと分かりやすくなります。",
      actions:
        "例）バイタル測定、患部確認、飲水介助、家族・主治医への連絡など。",
      goal: "例）今後観察すべき点、どこに報告するか。",
    },
    hints: {
      summary: "まず「何があったか」を簡潔にまとめてください。",
      details:
        "直前の様子、起きたこと、その後の様子の順で書くと分かりやすいです。",
      actions:
        "行った対応、申し送りたい内容などを具体的に書いてください。",
      goal: "誰が、どこまでやれば完了なのかを書いてください。",
      userName: "対象者が特定できるように記載してください。",
      eventDateTime: "起きた時間、気づいた時間を記載してください。",
      eventPlace: "施設内のどの場所で起きたかを書いてください。",
      vital: "数値がなければ空欄でもかまいません。",
      concern: "「なんとなく違う」と感じたことも重要な情報です。",
    },
    checks: {
      summary: { required: true, label: "概要" },
      details: { required: true, label: "詳しい状況" },
      actions: { required: false, label: "実施した対応" },
      goal: { required: false, label: "今後の対応" },
      vital: { required: false, label: "バイタル" },
      concern: { required: false, label: "違和感" },
    },
  },

  instruction: {
    name: "指示モード",
    description:
      "看護師・管理者・リーダーが、現場職員に誤解なく伝わる指示文を作成します。",
    labels: {
      summary: "指示の概要",
      details: "背景・理由",
      actions: "具体的な指示内容",
      goal: "完了条件・報告ライン",
    },
    placeholders: {
      summary: "例）◯◯様の水分量を本日からこまめにチェックしてください。",
      details:
        "例）最近脱水傾向が見られるため、本日の摂取量を把握したい。",
      actions:
        "例）1時間ごとに記録、状態変化があればすぐ報告、夜勤へ申し送り。",
      goal: "例）夕食後までに3回以上確認し、21時までに管理者へ報告。",
    },
    hints: {
      summary: "何の指示なのかを一文で記載してください。",
      details: "なぜその指示が必要なのか、背景を書いてください。",
      actions:
        "誰が、何を、いつからいつまで行うのかを明確にしてください。",
      goal: "どこまで行えば完了か、どこへ報告するかを書いてください。",
      userName: "対象者が分かるよう記載してください。",
      eventDateTime: "開始日時や期限があれば入れてください。",
      eventPlace: "指示が必要なフロアや場所があれば記載してください。",
      vital: "必要な場合のみ記入",
      concern: "気になる点があれば書いてください。",
    },
    checks: {
      summary: { required: true, label: "指示の概要" },
      details: { required: true, label: "背景・理由" },
      actions: { required: true, label: "具体的な指示内容" },
      goal: { required: true, label: "完了条件" },
    },
  },
};

/* -------------------------------------------------------
   Apply Mode (UI変更)
------------------------------------------------------- */
function applyMode(modeKey) {
  const mode = MODE_CONFIG[modeKey];

  modeDescription.textContent = mode.description;

  // Labels
  el("label-summary").textContent = mode.labels.summary;
  el("label-details").textContent = mode.labels.details;
  el("label-actions").textContent = mode.labels.actions;
  el("label-goal").textContent = mode.labels.goal;

  // Placeholders
  summaryInput.placeholder = mode.placeholders.summary;
  detailsInput.placeholder = mode.placeholders.details;
  actionsInput.placeholder = mode.placeholders.actions;
  goalInput.placeholder = mode.placeholders.goal;

  // Hints
  el("hint-summary").textContent = mode.hints.summary;
  el("hint-details").textContent = mode.hints.details;
  el("hint-actions").textContent = mode.hints.actions;
  el("hint-goal").textContent = mode.hints.goal;
  el("hint-userName").textContent = mode.hints.userName;
  el("hint-eventDateTime").textContent = mode.hints.eventDateTime;
  el("hint-eventPlace").textContent = mode.hints.eventPlace;
  el("hint-vital").textContent = mode.hints.vital;
  el("hint-concern").textContent = mode.hints.concern;

  // Reset score + outputs
  resetOutputs();
}

/* -------------------------------------------------------
   Reset outputs
------------------------------------------------------- */
function resetOutputs() {
  localScoreValueEl.textContent = "-";
  localScoreDetailEl.textContent = "";
  localScoreLevelEl.textContent = "まだ評価が行われていません。";

  aiScoreValueEl.textContent = "-";
  aiFeedbackEl.innerHTML = "";

  aiRewriteEl.textContent = "";
  aiRewriteText.value = "";
  aiRewriteCard.style.display = "none";

  aiShortCard.style.display = "none";
  aiShortText.value = "";

  generatedReportEl.textContent = "";

  errorMessageEl.style.display = "none";
  errorMessageEl.textContent = "";
}

/* -------------------------------------------------------
   Vital builder
------------------------------------------------------- */
function buildVital() {
  const parts = [];
  if (tempInput.value) parts.push(`BT ${tempInput.value}℃`);
  if (bpSysInput.value && bpDiaInput.value)
    parts.push(`BP ${bpSysInput.value}/${bpDiaInput.value}`);
  if (pulseInput.value) parts.push(`P ${pulseInput.value}`);
  if (spo2Input.value) parts.push(`SpO2 ${spo2Input.value}%`);

  return parts.join("、");
}

/* -------------------------------------------------------
   Build Report (通常モード)
------------------------------------------------------- */
function buildReport(modeKey) {
  const mode = MODE_CONFIG[modeKey];

  let text = "";

  text += `【モード】${mode.name}\n\n`;
  text += `■ 概要\n・${summaryInput.value.trim() || "（未入力）"}\n\n`;
  text += `■ 基本情報\n`;
  text += `・対象：${userNameInput.value.trim() || "（未入力）"}\n`;
  text += `・日時：${eventDateTimeInput.value.trim() || "（未入力）"}\n`;
  text += `・場所：${eventPlaceInput.value.trim() || "（未入力）"}\n\n`;

  text += `■ 詳しい状況・経過\n・${detailsInput.value.trim() || "（未入力）"}\n\n`;

  const vitalText = buildVital();
  text += `■ バイタル／数値情報\n・${vitalText || "（未入力）"}\n\n`;

  text += `■ ${mode.labels.actions}\n・${actionsInput.value.trim() || "（未入力）"}\n\n`;
  text += `■ ${mode.labels.goal}\n・${goalInput.value.trim() || "（未入力）"}\n\n`;

  text += `■ 職員として感じた違和感\n・${concernInput.value.trim() || "（未入力）"}\n\n`;

  text += `■ 作成者\n・${reporterNameInput.value.trim() || "（未入力）"}\n`;

  return text;
}

/* -------------------------------------------------------
   Quick Tags
------------------------------------------------------- */
quickTagButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("is-selected");
  });
});

function getSelectedQuickTags() {
  return Array.from(quickTagButtons)
    .filter((btn) => btn.classList.contains("is-selected"))
    .map((btn) => btn.dataset.tag);
}

/* -------------------------------------------------------
   Build Report from Quick Input
------------------------------------------------------- */
function buildReportFromQuick(modeKey) {
  const mode = MODE_CONFIG[modeKey];
  const bulletsRaw = quickBulletsInput.value.trim();

  if (!bulletsRaw) throw new Error("要点メモ（3〜5行）を入力してください。");

  const bullets = bulletsRaw
    .split("\n")
    .map((line) => line.replace(/^・/, "").trim())
    .filter((line) => line.length > 0);

  if (bullets.length === 0) throw new Error("要点メモに有効な行がありません。");

  const tags = getSelectedQuickTags();

  const targetUser = userNameInput.value.trim();
  const eventDateTime = eventDateTimeInput.value.trim();
  const place = eventPlaceInput.value.trim();

  let text = "";
  text += `【モード】${mode.name}（かんたん入力から自動構成）\n\n`;

  if (tags.length > 0) {
    text += `■ カテゴリ・目的\n`;
    text += `・${tags.join("／")}\n\n`;
  }

  text += `■ 要点メモ（職員入力）\n`;
  bullets.forEach((b) => {
    text += `・${b}\n`;
  });
  text += "\n";

  text += "■ 参考情報（入力がある場合のみ使用）\n";
  if (targetUser) text += `・対象者：${targetUser}\n`;
  if (eventDateTime) text += `・日時：${eventDateTime}\n`;
  if (place) text += `・場所：${place}\n`;
  if (!targetUser && !eventDateTime && !place) {
    text += "・（対象者・日時・場所は未入力）\n";
  }

  text +=
    "\n※この情報をもとに、管理者・看護師が読んで誤解なく伝わる文章に再構成してください。\n";

  return text;
}

/* -------------------------------------------------------
   Local Score
------------------------------------------------------- */
function evaluateLocal(modeKey) {
  const mode = MODE_CONFIG[modeKey];

  if (currentInputMode === "quick") {
    let score = 80;
    const missingRequired = [];
    const missingOptional = [];

    if (
      !summaryInput.value.trim() &&
      !quickBulletsInput.value.trim()
    ) {
      missingRequired.push("概要／要点");
      score -= 20;
    }

    if (userNameInput.value.trim()) score += 5;
    if (eventDateTimeInput.value.trim()) score += 5;

    if (score > 100) score = 100;

    localScoreValueEl.textContent = score;

    let level = "";
    if (score >= 90) level = "ほぼ完成レベル（クイック）";
    else if (score >= 75) level = "忙しいときの報告として十分";
    else if (score >= 60) level = "要点は伝わるが、もう少し補足すると◎";
    else level = "重要な情報が不足している可能性あり";

    localScoreLevelEl.textContent = level;

    const list = [];
    if (missingRequired.length > 0)
      list.push("【必須】" + missingRequired.join("／"));
    if (missingOptional.length > 0)
      list.push("【追加すると良い】" + missingOptional.join("／"));

    localScoreDetailEl.textContent = list.join("\n");

    return { score, missingRequired, missingOptional };
  }

  // 通常モード
  let score = 100;
  const missingRequired = [];
  const missingOptional = [];

  const checks = mode.checks || {};

  Object.entries(checks).forEach(([key, cfg]) => {
    let value = "";

    switch (key) {
      case "summary":
        value = summaryInput.value.trim();
        break;
      case "details":
        value = detailsInput.value.trim();
        break;
      case "actions":
        value = actionsInput.value.trim();
        break;
      case "goal":
        value = goalInput.value.trim();
        break;
      case "vital":
        value =
          tempInput.value.trim() ||
          bpSysInput.value.trim() ||
          bpDiaInput.value.trim() ||
          pulseInput.value.trim() ||
          spo2Input.value.trim();
        break;
      case "concern":
        value = concernInput.value.trim();
        break;
    }

    if (!value) {
      if (cfg.required) {
        missingRequired.push(cfg.label);
        score -= 20;
      } else {
        missingOptional.push(cfg.label);
        score -= 8;
      }
    }
  });

  if (score > 100) score = 100;
  if (score < 20) score = 20;

  localScoreValueEl.textContent = score;

  let level = "";
  if (score >= 90) level = "ほぼ完成レベル";
  else if (score >= 75) level = "管理者が安心できるレベル";
  else if (score >= 60) level = "大枠OK。もう一歩深掘りしたい";
  else level = "重要な情報が不足している可能性あり";

  localScoreLevelEl.textContent = level;

  const list = [];
  if (missingRequired.length > 0)
    list.push("【必須】" + missingRequired.join("／"));
  if (missingOptional.length > 0)
    list.push("【追加すると良い】" + missingOptional.join("／"));

  localScoreDetailEl.textContent = list.join("\n");

  return { score, missingRequired, missingOptional };
}

/* -------------------------------------------------------
   AI Evaluation
------------------------------------------------------- */
async function callAiEvaluate(payload) {
  try {
    errorMessageEl.style.display = "none";
    errorMessageEl.textContent = "";

    const res = await fetch("/api/evaluate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "AI応答でエラーが発生しました。");
    }

    const { aiScore, feedbackText, rewriteText, shortText } = data;

    aiScoreValueEl.textContent = aiScore != null ? aiScore : "-";

    aiFeedbackEl.innerHTML = "";
    (feedbackText || "")
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0)
      .forEach((b) => {
        const p = document.createElement("p");
        p.textContent = b;
        aiFeedbackEl.appendChild(p);
      });

    aiRewriteEl.textContent = rewriteText || "";
    if (rewriteText) {
      aiRewriteCard.style.display = "block";
      aiRewriteText.value = rewriteText;
    } else {
      aiRewriteCard.style.display = "none";
      aiRewriteText.value = "";
    }

    // 3行要約
    if (shortText && shortText.trim()) {
      aiShortCard.style.display = "block";
      aiShortText.value = shortText.trim();
    } else {
      aiShortCard.style.display = "none";
      aiShortText.value = "";
    }
  } catch (err) {
    errorMessageEl.style.display = "block";
    errorMessageEl.textContent = err.message;
  }
}

/* -------------------------------------------------------
   Events
------------------------------------------------------- */

/* モード切替 */
modeSelect.addEventListener("change", () => {
  currentInputMode = "normal";
  applyMode(modeSelect.value);
});

/* 通常モード：AI用文章生成 */
btnGenerate.addEventListener("click", () => {
  try {
    currentInputMode = "normal";
    const modeKey = modeSelect.value;

    resetOutputs();
    const text = buildReport(modeKey);
    generatedReportEl.textContent = text;

    evaluateLocal(modeKey);
  } catch (err) {
    errorMessageEl.style.display = "block";
    errorMessageEl.textContent = err.message;
  }
});

/* 通常モード：管理者チェック */
btnEvaluate.addEventListener("click", () => {
  try {
    const modeKey = modeSelect.value;
    const reportText = generatedReportEl.textContent.trim();
    if (!reportText) throw new Error("先に「AI用の文章を作る」を押してください。");

    const { score, missingRequired, missingOptional } = evaluateLocal(modeKey);

    callAiEvaluate({
      mode: modeKey,
      reportText,
      localScore: score,
      missingRequired,
      missingOptional,
    });
  } catch (err) {
    errorMessageEl.style.display = "block";
    errorMessageEl.textContent = err.message;
  }
});

/* かんたん入力モード */
btnQuickGenerate.addEventListener("click", () => {
  try {
    currentInputMode = "quick";
    resetOutputs();

    const modeKey = modeSelect.value;
    const text = buildReportFromQuick(modeKey);
    generatedReportEl.textContent = text;

    const { score, missingRequired, missingOptional } = evaluateLocal(modeKey);

    callAiEvaluate({
      mode: modeKey,
      reportText: text,
      localScore: score,
      missingRequired,
      missingOptional,
    });
  } catch (err) {
    errorMessageEl.style.display = "block";
    errorMessageEl.textContent = err.message;
  }
});

/* 書き直しコピー */
btnCopyRewrite.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(aiRewriteText.value);
  } catch (err) {
    console.error(err);
  }
});

/* 上のAI文章に反映 */
btnApplyRewrite.addEventListener("click", () => {
  generatedReportEl.textContent = aiRewriteText.value;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* 3行要約コピー */
btnCopyShort.addEventListener("click", async () => {
  try {
    if (aiShortText.value.trim()) {
      await navigator.clipboard.writeText(aiShortText.value);
    }
  } catch (err) {
    console.error(err);
  }
});

/* -------------------------------------------------------
   Init
------------------------------------------------------- */
applyMode("report");
