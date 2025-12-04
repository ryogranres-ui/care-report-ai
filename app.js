// ---------------------------------------------
// DOM util
// ---------------------------------------------
const el = (id) => document.getElementById(id);

// モード
const modeSelect = el("modeSelect");
const modeDescription = el("modeDescription");

// 基本情報
const reporterNameInput = el("reporterName");
const userNameInput = el("userName");
const eventDateTimeInput = el("eventDateTime");
const eventPlaceInput = el("eventPlace");
const tempInput = el("tempInput");
const bpSysInput = el("bpSysInput");
const bpDiaInput = el("bpDiaInput");
const pulseInput = el("pulseInput");
const spo2Input = el("spo2Input");

// AIヒアリング
const dialogueSeedInput = el("dialogueSeed");
const dialogueHintEl = el("dialogueHint");
const btnStartDialogue = el("btnStartDialogue");
const dialogueArea = el("dialogueArea");
const dialogueAnswerArea = el("dialogueAnswerArea");
const dialogueAnswerInput = el("dialogueAnswerInput");
const btnSendAnswer = el("btnSendAnswer");
const btnFinishDialogue = el("btnFinishDialogue");

// 出力
const localScoreValueEl = el("localScoreValue");
const localScoreLevelEl = el("localScoreLevel");
const localScoreDetailEl = el("localScoreDetail");

const generatedReportEl = el("generatedReport");
const aiFeedbackEl = el("aiFeedback");

const aiRewriteCard = el("aiRewriteCard");
const aiRewriteText = el("aiRewriteText");

const aiShortCard = el("aiShortCard");
const aiShortText = el("aiShortText");

const toggleEducation = el("toggleEducation");
const educationBlock = el("educationBlock");
const educationText = el("educationText");

// 医師向けまとめ
const doctorSummaryCard = el("doctorSummaryCard");
const doctorSummaryText = el("doctorSummaryText");
const btnCopyDoctor = el("btnCopyDoctor");

// ボタン（コピー系）
const btnCopyRewrite = el("btnCopyRewrite");
const btnApplyRewrite = el("btnApplyRewrite");
const btnCopyShort = el("btnCopyShort");
const btnCopyEducation = el("btnCopyEducation");

// エラー
const errorMessageEl = el("errorMessage");

// ---------------------------------------------
// 状態
// ---------------------------------------------
const dialogueState = {
  questions: [], // [{question, point}]
  index: 0,
  qa: [], // [{question, answer}]
};

// ---------------------------------------------
// モード説明
// ---------------------------------------------
const MODE_CONFIG = {
  report: {
    name: "共有・報告モード",
    description:
      "利用者の事故・状態変化・家族連絡などを、管理者や看護師に正確に伝える報告文を作成します。",
  },
  instruction: {
    name: "指示モード",
    description:
      "看護師・管理者が現場へ指示を出す際の文章作成を支援します。（※質問ロジックは共有用に最適化中）",
  },
};

function applyMode(modeKey) {
  const mode = MODE_CONFIG[modeKey] || MODE_CONFIG.report;
  modeDescription.textContent = mode.description;
  resetOutputs();
  clearDialogue();
}

// ---------------------------------------------
// 共通リセット
// ---------------------------------------------
function resetOutputs() {
  localScoreValueEl.textContent = "-";
  localScoreLevelEl.textContent = "まだ評価が行われていません。";
  localScoreDetailEl.textContent = "";

  generatedReportEl.textContent = "";

  aiFeedbackEl.innerHTML = "";

  aiRewriteText.value = "";
  aiRewriteCard.style.display = "none";

  aiShortCard.style.display = "none";
  aiShortText.value = "";

  educationText.value = "";
  educationBlock.style.display = "none";

  doctorSummaryText.value = "";
  doctorSummaryCard.style.display = "none";

  errorMessageEl.style.display = "none";
  errorMessageEl.textContent = "";
}

// ---------------------------------------------
// バイタル整形
// ---------------------------------------------
function buildVital() {
  const parts = [];
  if (tempInput.value) parts.push(`BT ${tempInput.value}℃`);
  if (bpSysInput.value && bpDiaInput.value)
    parts.push(`BP ${bpSysInput.value}/${bpDiaInput.value}`);
  if (pulseInput.value) parts.push(`P ${pulseInput.value}`);
  if (spo2Input.value) parts.push(`SpO2 ${spo2Input.value}%`);
  return parts.join("、");
}

// ---------------------------------------------
// ローカルスコア（簡易）
// ---------------------------------------------
function evaluateLocal() {
  let score = 60;
  const detailLines = [];

  if (userNameInput.value.trim()) score += 10;
  else detailLines.push("【追加すると良い】対象利用者の名前");

  if (eventDateTimeInput.value.trim()) score += 10;
  else detailLines.push("【追加すると良い】日時");

  if (dialogueState.qa.length >= 3) score += 20;
  else if (dialogueState.qa.length >= 1) score += 10;
  else detailLines.push("【必須】AIの質問に1つ以上回答");

  if (score > 100) score = 100;

  localScoreValueEl.textContent = score;
  let level = "";
  if (score >= 90) level = "ほぼ完成レベル";
  else if (score >= 75) level = "忙しいときの報告として十分";
  else if (score >= 60) level = "要点は伝わるが、もう少し情報が欲しい";
  else level = "重要な情報が不足している可能性あり";

  localScoreLevelEl.textContent = level;
  localScoreDetailEl.textContent = detailLines.join("\n");

  return score;
}

// ---------------------------------------------
// API 呼び出し共通
// ---------------------------------------------
async function callApi(payload) {
  const res = await fetch("/api/evaluate-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "AI応答でエラーが発生しました。");
  }
  return data;
}

// ---------------------------------------------
// ダイアログ表示ヘルパー
// ---------------------------------------------
function clearDialogue() {
  dialogueState.questions = [];
  dialogueState.index = 0;
  dialogueState.qa = [];
  dialogueArea.innerHTML = "";
  dialogueAnswerArea.style.display = "none";
  dialogueAnswerInput.value = "";
  dialogueHintEl.textContent =
    "例のように、ざっくりで構いません。難しく考えなくてOKです。";

  // 報告文作成ボタンを無効に戻す（白のアウトライン）
  btnFinishDialogue.disabled = true;
  btnFinishDialogue.classList.remove("btn-primary");
  if (!btnFinishDialogue.classList.contains("btn-outline")) {
    btnFinishDialogue.classList.add("btn-outline");
  }
}

function appendQuestion(qObj) {
  const wrapper = document.createElement("div");
  wrapper.className = "dialogue-item";

  const qDiv = document.createElement("div");
  qDiv.className = "dialogue-q";

  const label = document.createElement("span");
  label.className = "dialogue-q-label";
  label.textContent = "AI：";
  qDiv.appendChild(label);

  const textSpan = document.createElement("span");
  textSpan.textContent = qObj.question;
  qDiv.appendChild(textSpan);

  if (qObj.point) {
    const pointDiv = document.createElement("div");
    pointDiv.className = "dialogue-point";
    pointDiv.textContent = `POINT：${qObj.point}`;
    if (!toggleEducation.checked) {
      pointDiv.style.display = "none";
    }
    qDiv.appendChild(pointDiv);
  }

  wrapper.appendChild(qDiv);
  dialogueArea.appendChild(wrapper);
  dialogueArea.scrollTop = dialogueArea.scrollHeight;
}

function appendAnswer(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "dialogue-item";

  const aDiv = document.createElement("div");
  aDiv.className = "dialogue-a";

  const label = document.createElement("span");
  label.className = "dialogue-a-label";
  label.textContent = "職員：";
  aDiv.appendChild(label);

  const span = document.createElement("span");
  span.textContent = text;
  aDiv.appendChild(span);

  wrapper.appendChild(aDiv);
  dialogueArea.appendChild(wrapper);
  dialogueArea.scrollTop = dialogueArea.scrollHeight;
}

// ---------------------------------------------
// モード変更
// ---------------------------------------------
modeSelect.addEventListener("change", () => {
  applyMode(modeSelect.value);
});

// ---------------------------------------------
// AIヒアリング開始（generateQuestions）
// ---------------------------------------------
btnStartDialogue.addEventListener("click", async () => {
  try {
    resetOutputs();
    clearDialogue();

    const seed = dialogueSeedInput.value.trim();
    if (!seed) {
      throw new Error("まず「いま起きていること」を1〜2行で入力してください。");
    }

    dialogueHintEl.textContent =
      "AIが状況に合わせて3〜7個ほど質問を出します。1つずつ回答してください。";

    const modeKey = modeSelect.value;

    const data = await callApi({
      flow: "generateQuestions",
      mode: modeKey,
      seedText: seed,
      userName: userNameInput.value.trim(),
      vitalText: buildVital(),
    });

    const questions = data.questions || [];
    if (!questions.length) {
      throw new Error("AIから質問を取得できませんでした。");
    }

    dialogueState.questions = questions;
    dialogueState.index = 0;
    dialogueState.qa = [];

    appendQuestion(questions[0]);
    dialogueAnswerArea.style.display = "block";
    dialogueAnswerInput.focus();
  } catch (err) {
    errorMessageEl.style.display = "block";
    errorMessageEl.textContent = err.message;
  }
});

// 回答送信
btnSendAnswer.addEventListener("click", () => {
  try {
    if (!dialogueState.questions.length) return;

    const answer = dialogueAnswerInput.value.trim();
    if (!answer) return;

    const currentIdx = dialogueState.index;
    const questions = dialogueState.questions;
    const currentQ = questions[currentIdx];

    // Q&A を保存
    dialogueState.qa.push({
      question: currentQ.question,
      answer,
    });

    // 画面に回答を追加
    appendAnswer(answer);
    dialogueAnswerInput.value = "";

    // 次の質問へ
    dialogueState.index = currentIdx + 1;

    const isLastRealQuestion = dialogueState.index >= questions.length;

    if (!isLastRealQuestion) {
      // まだ質問が残っている場合 → 次の質問を表示
      appendQuestion(questions[dialogueState.index]);
      dialogueAnswerInput.focus();
    } else {
      // すべての質問が終わった場合 → 終了メッセージ＋ボタン有効化
      const finalQ = {
        question:
          "質問は以上です。この内容で報告文を作成する場合は、下の「この内容で報告文を作成」を押してください。",
        point: "",
      };
      appendQuestion(finalQ);

      dialogueHintEl.textContent =
        "質問は終了しました。「この内容で報告文を作成」を押すと文章が自動生成されます。";

      // ここで初めて報告文作成ボタンを有効化＆青色に変更
      btnFinishDialogue.disabled = false;
      btnFinishDialogue.classList.remove("btn-outline");
      btnFinishDialogue.classList.add("btn-primary");
      dialogueAnswerInput.focus();
    }
  } catch (err) {
    errorMessageEl.style.display = "block";
    errorMessageEl.textContent = err.message;
  }
});

// 報告文作成（buildReport → fullEvaluate）
btnFinishDialogue.addEventListener("click", async () => {
  try {
    if (btnFinishDialogue.disabled) {
      return; // 質問が終わっていない状態では動かさない
    }

    errorMessageEl.style.display = "none";
    errorMessageEl.textContent = "";

    // 入力途中の回答が残っていたら送る
    if (dialogueAnswerInput.value.trim()) {
      btnSendAnswer.click();
    }

    if (!dialogueState.qa.length) {
      throw new Error("AIの質問に1つ以上回答してから実行してください。");
    }

    const modeKey = modeSelect.value;

    // ① Q&A から本文生成
    const buildRes = await callApi({
      flow: "buildReport",
      mode: modeKey,
      qaLog: dialogueState.qa,
      basicInfo: {
        reporterName: reporterNameInput.value.trim(),
        userName: userNameInput.value.trim(),
        eventDateTime: eventDateTimeInput.value.trim(),
        eventPlace: eventPlaceInput.value.trim(),
        vitalText: buildVital(),
      },
    });

    const reportText = buildRes.reportText || "";

    // ② ローカルスコア
    const localScore = evaluateLocal();

    // ③ fullEvaluate（フィードバック＋書き直し＋3行要約＋重要ポイント＋医師向け）
    const evalRes = await callApi({
      flow: "fullEvaluate",
      mode: modeKey,
      reportText,
      localScore,
      includeEducation: toggleEducation.checked,
    });

    const {
      aiScore, // 今はUI表示しないが一応受け取る
      feedbackText,
      rewriteText,
      shortText,
      educationText: edu,
      doctorText,
    } = evalRes;

    // 最終版：書き直しがあればそれを優先
    const finalText =
      rewriteText && rewriteText.trim().length ? rewriteText.trim() : reportText;

    generatedReportEl.textContent = finalText;

    // フィードバック本文（①〜④のみ）
    aiFeedbackEl.innerHTML = "";
    (feedbackText || "")
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean)
      .forEach((b) => {
        const p = document.createElement("p");
        p.textContent = b;
        aiFeedbackEl.appendChild(p);
      });

    // 編集用テキスト
    if (finalText) {
      aiRewriteCard.style.display = "block";
      aiRewriteText.value = finalText;
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

    // 重要ポイント
    if (edu && edu.trim()) {
      educationText.value = edu.trim();
      if (toggleEducation.checked) {
        educationBlock.style.display = "block";
      } else {
        educationBlock.style.display = "none";
      }
    } else {
      educationText.value = "";
      educationBlock.style.display = "none";
    }

    // 医師向けまとめ
    if (doctorText && doctorText.trim()) {
      doctorSummaryText.value = doctorText.trim();
      doctorSummaryCard.style.display = "block";
    } else {
      doctorSummaryText.value = "";
      doctorSummaryCard.style.display = "none";
    }
  } catch (err) {
    errorMessageEl.style.display = "block";
    errorMessageEl.textContent = err.message;
  }
});

// 書き直しコピー
btnCopyRewrite.addEventListener("click", async () => {
  try {
    if (aiRewriteText.value.trim()) {
      await navigator.clipboard.writeText(aiRewriteText.value);
    }
  } catch (e) {
    console.error(e);
  }
});

// 書き直しを共有文章に反映
btnApplyRewrite.addEventListener("click", () => {
  generatedReportEl.textContent = aiRewriteText.value;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// 3行要約コピー
btnCopyShort.addEventListener("click", async () => {
  try {
    if (aiShortText.value.trim()) {
      await navigator.clipboard.writeText(aiShortText.value);
    }
  } catch (e) {
    console.error(e);
  }
});

// 重要ポイントコピー
btnCopyEducation.addEventListener("click", async () => {
  try {
    if (educationText.value.trim()) {
      await navigator.clipboard.writeText(educationText.value);
    }
  } catch (e) {
    console.error(e);
  }
});

// 医師向けまとめコピー
btnCopyDoctor.addEventListener("click", async () => {
  try {
    if (doctorSummaryText.value.trim()) {
      await navigator.clipboard.writeText(doctorSummaryText.value);
    }
  } catch (e) {
    console.error(e);
  }
});

// 重要ポイントトグル：質問側のPOINT表示とブロック表示を切替
toggleEducation.addEventListener("change", () => {
  const show = toggleEducation.checked;
  document.querySelectorAll(".dialogue-point").forEach((el) => {
    el.style.display = show ? "block" : "none";
  });
  if (show && educationText.value.trim()) {
    educationBlock.style.display = "block";
  } else {
    educationBlock.style.display = "none";
  }
});

// 初期化
applyMode("report");
