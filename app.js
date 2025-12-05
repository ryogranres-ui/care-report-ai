// app.js
// Care Report AI フロントロジック（新API仕様 & 現行HTML専用）
//
// バックエンド: /api/evaluate-report
//   flow: "classifyEvent" / "nextQuestion" / "fullEvaluate"
//
// index.html の主な要素と対応:
// STEP1: reporterName, userName, eventDateTime, eventPlace, tempInput, bpSysInput, bpDiaInput, pulseInput, spo2Input
// STEP2: dialogueSeed, btnStartDialogue, dialogueArea, dialogueAnswerArea, dialogueAnswerInput, btnSendAnswer, btnFinishDialogue
// STEP3: localScoreValue, localScoreLevel, localScoreDetail,
//        generatedReport, aiFeedback, educationText,
//        aiShortText, doctorSummaryText, etc.

const API_ENDPOINT = "/api/evaluate-report";

const appState = {
  basicInfo: {
    authorName: "",
    targetPerson: "",
    datetime: "",
    place: "",
    vitals: {
      bt: "",
      bpSys: "",
      bpDia: "",
      pulse: "",
      spo2: "",
    },
  },
  summary: "",
  eventCategory: null, // "A"〜"E"
  eventCategoryLabel: "",
  qaLog: [],
  currentQuestion: null,
  allQuestionsDone: false,
  facilityReportText: "",
  evaluationResult: null,
  isClassifying: false,
  isAskingQuestion: false,
  isEvaluating: false,
};

const DOM = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  injectQuestionOptionContainer();
  bindEvents();
  resetUI();
});

/* -----------------------------
 * DOM キャッシュ
 * --------------------------- */
function cacheDom() {
  // STEP1
  DOM.authorNameInput = document.getElementById("reporterName");
  DOM.targetPersonInput = document.getElementById("userName");
  DOM.datetimeInput = document.getElementById("eventDateTime");
  DOM.placeInput = document.getElementById("eventPlace");
  DOM.btInput = document.getElementById("tempInput");
  DOM.bpSysInput = document.getElementById("bpSysInput");
  DOM.bpDiaInput = document.getElementById("bpDiaInput");
  DOM.pulseInput = document.getElementById("pulseInput");
  DOM.spo2Input = document.getElementById("spo2Input");

  // STEP2
  DOM.summaryInput = document.getElementById("dialogueSeed");
  DOM.startQuestionsButton = document.getElementById("btnStartDialogue");
  DOM.dialogueLog = document.getElementById("dialogueArea");
  DOM.questionBlock = document.getElementById("dialogueAnswerArea");
  DOM.questionFreeTextInput = document.getElementById("dialogueAnswerInput");
  DOM.submitAnswerButton = document.getElementById("btnSendAnswer");
  DOM.generateReportButton = document.getElementById("btnFinishDialogue");
  DOM.dialogueHint = document.getElementById("dialogueHint");

  // STEP3
  DOM.localScoreValue = document.getElementById("localScoreValue");
  DOM.localScoreLevel = document.getElementById("localScoreLevel");
  DOM.localScoreDetail = document.getElementById("localScoreDetail");

  DOM.generatedReport = document.getElementById("generatedReport");
  DOM.aiFeedback = document.getElementById("aiFeedback");
  DOM.toggleEducation = document.getElementById("toggleEducation");
  DOM.educationBlock = document.getElementById("educationBlock");
  DOM.educationText = document.getElementById("educationText");

  DOM.aiRewriteCard = document.getElementById("aiRewriteCard");
  DOM.aiRewriteText = document.getElementById("aiRewriteText");
  DOM.btnCopyRewrite = document.getElementById("btnCopyRewrite");
  DOM.btnApplyRewrite = document.getElementById("btnApplyRewrite");

  DOM.aiShortCard = document.getElementById("aiShortCard");
  DOM.aiShortText = document.getElementById("aiShortText");
  DOM.btnCopyShort = document.getElementById("btnCopyShort");

  DOM.doctorSummaryCard = document.getElementById("doctorSummaryCard");
  DOM.doctorSummaryText = document.getElementById("doctorSummaryText");
  DOM.btnCopyDoctor = document.getElementById("btnCopyDoctor");

  DOM.btnCopyEducation = document.getElementById("btnCopyEducation");

  // エラー表示
  DOM.errorMessage = document.getElementById("errorMessage");

  // モード（現状は報告モードのみ対応）
  DOM.modeSelect = document.getElementById("modeSelect");
  DOM.modeDescription = document.getElementById("modeDescription");
}

/* -----------------------------
 * 質問用コンテナを挿入
 * --------------------------- */
function injectQuestionOptionContainer() {
  // dialogueAnswerArea 内に、選択肢描画用コンテナを追加
  const answerArea = document.getElementById("dialogueAnswerArea");
  if (!answerArea) return;

  const container = document.createElement("div");
  container.id = "questionOptionsContainer";
  container.className = "question-options";
  answerArea.insertBefore(container, document.getElementById("dialogueAnswerInput"));

  // 新人向けヒント用
  const hint = document.createElement("div");
  hint.id = "questionHint";
  hint.className = "question-hint";
  answerArea.insertBefore(hint, document.getElementById("dialogueAnswerInput"));
}

/* -----------------------------
 * イベントバインド
 * --------------------------- */
function bindEvents() {
  if (DOM.startQuestionsButton) {
    DOM.startQuestionsButton.addEventListener("click", (e) => {
      e.preventDefault();
      startAIQuestionsFlow();
    });
  }

  if (DOM.submitAnswerButton) {
    DOM.submitAnswerButton.addEventListener("click", (e) => {
      e.preventDefault();
      submitCurrentAnswer();
    });
  }

  if (DOM.generateReportButton) {
    DOM.generateReportButton.addEventListener("click", (e) => {
      e.preventDefault();
      generateAndEvaluateReport();
    });
  }

  if (DOM.toggleEducation && DOM.educationBlock) {
    DOM.toggleEducation.addEventListener("change", () => {
      DOM.educationBlock.style.display = DOM.toggleEducation.checked ? "block" : "none";
    });
  }

  if (DOM.btnCopyEducation && DOM.educationText) {
    DOM.btnCopyEducation.addEventListener("click", () => {
      copyToClipboard(DOM.educationText.value, "重要ポイントをコピーしました。");
    });
  }

  if (DOM.btnCopyRewrite && DOM.aiRewriteText) {
    DOM.btnCopyRewrite.addEventListener("click", () => {
      copyToClipboard(DOM.aiRewriteText.value, "AIが整えた文章をコピーしました。");
    });
  }

  if (DOM.btnApplyRewrite && DOM.aiRewriteText && DOM.generatedReport) {
    DOM.btnApplyRewrite.addEventListener("click", () => {
      DOM.generatedReport.textContent = DOM.aiRewriteText.value;
      alert("AIが整えた文章を『施設内共有向けの文章』に反映しました。");
    });
  }

  if (DOM.btnCopyShort && DOM.aiShortText) {
    DOM.btnCopyShort.addEventListener("click", () => {
      copyToClipboard(DOM.aiShortText.value, "3行要約をコピーしました。");
    });
  }

  if (DOM.btnCopyDoctor && DOM.doctorSummaryText) {
    DOM.btnCopyDoctor.addEventListener("click", () => {
      copyToClipboard(DOM.doctorSummaryText.value, "医師報告用の文章をコピーしました。");
    });
  }

  if (DOM.modeSelect && DOM.modeDescription) {
    DOM.modeSelect.addEventListener("change", () => {
      const v = DOM.modeSelect.value;
      if (v === "report") {
        DOM.modeDescription.textContent =
          "利用者の事故・状態変化・家族連絡などを、管理者や看護師に正確に伝える報告文を作成します。";
      } else {
        DOM.modeDescription.textContent =
          "指示モードは今後拡張予定です。現在は共有・報告モードのみ利用できます。";
        alert("指示モードは準備中です。現在は『共有・報告モード』をご利用ください。");
        DOM.modeSelect.value = "report";
      }
    });
  }
}

/* -----------------------------
 * 初期化
 * --------------------------- */
function resetUI() {
  clearError();
  if (DOM.dialogueHint) {
    DOM.dialogueHint.textContent =
      "例のように、ざっくりで構いません。難しく考えなくてOKです。";
  }
  if (DOM.dialogueLog) {
    DOM.dialogueLog.innerHTML = "";
  }
  if (DOM.questionBlock) {
    DOM.questionBlock.style.display = "none";
  }
  if (DOM.generateReportButton) {
    DOM.generateReportButton.disabled = true;
  }
  if (DOM.localScoreValue) {
    DOM.localScoreValue.textContent = "-";
  }
  if (DOM.localScoreLevel) {
    DOM.localScoreLevel.textContent = "まだ評価が行われていません。";
  }
  if (DOM.localScoreDetail) {
    DOM.localScoreDetail.textContent = "";
  }
  if (DOM.generatedReport) {
    DOM.generatedReport.textContent = "";
  }
  if (DOM.aiFeedback) {
    DOM.aiFeedback.textContent = "";
  }
  if (DOM.educationText) {
    DOM.educationText.value = "";
  }
  if (DOM.aiRewriteCard) DOM.aiRewriteCard.style.display = "none";
  if (DOM.aiShortCard) DOM.aiShortCard.style.display = "none";
  if (DOM.doctorSummaryCard) DOM.doctorSummaryCard.style.display = "none";

  appState.qaLog = [];
  appState.currentQuestion = null;
  appState.allQuestionsDone = false;
  appState.evaluationResult = null;
}

/* -----------------------------
 * STEP1: 基本情報を state に保存
 * --------------------------- */
function saveStep1() {
  appState.basicInfo = {
    authorName: DOM.authorNameInput?.value?.trim() || "",
    targetPerson: DOM.targetPersonInput?.value?.trim() || "",
    datetime: DOM.datetimeInput?.value || "",
    place: DOM.placeInput?.value?.trim() || "",
    vitals: {
      bt: DOM.btInput?.value?.trim() || "",
      bpSys: DOM.bpSysInput?.value?.trim() || "",
      bpDia: DOM.bpDiaInput?.value?.trim() || "",
      pulse: DOM.pulseInput?.value?.trim() || "",
      spo2: DOM.spo2Input?.value?.trim() || "",
    },
  };
}

/* -----------------------------
 * STEP2: AIヒアリング開始
 * --------------------------- */
async function startAIQuestionsFlow() {
  try {
    clearError();

    saveStep1();

    const summary = DOM.summaryInput?.value?.trim() || "";
    if (!summary) {
      alert("『いま起きていること』を1〜2行で入力してください。");
      return;
    }
    appState.summary = summary;

    appState.isClassifying = true;
    setDialogueHint("AIが状況を確認しています...");
    disableStep2Buttons(true);

    // 1) イベント分類（今回は manualCategory は使わず、AIにおまかせ）
    const classifyPayload = {
      flow: "classifyEvent",
      summary: appState.summary,
      basicInfo: appState.basicInfo,
      manualCategory: null,
    };

    const classifyRes = await callApi(classifyPayload);
    if (!classifyRes.ok) {
      throw new Error(classifyRes.error || "イベントの分類に失敗しました。");
    }

    appState.eventCategory = classifyRes.finalCategory;
    appState.eventCategoryLabel = classifyRes.categoryLabel;

    // ログに「AIの見立て」を1行表示
    appendDialogueSystem(
      `この内容は「${classifyRes.categoryLabel}」として扱います。必要なことを順番にお聞きします。`
    );

    setDialogueHint("AIからの質問に答えていくだけで、報告に必要な情報がそろいます。");

    // 質問ログ初期化
    appState.qaLog = [];
    appState.allQuestionsDone = false;
    appState.currentQuestion = null;

    // 2) 最初の質問取得
    await fetchNextQuestion();
  } catch (err) {
    console.error(err);
    setError(err.message || "AIヒアリングの開始に失敗しました。");
  } finally {
    appState.isClassifying = false;
    disableStep2Buttons(false);
  }
}

/* -----------------------------
 * 次の質問を取得
 * --------------------------- */
async function fetchNextQuestion() {
  try {
    appState.isAskingQuestion = true;
    setDialogueHint("次の質問を考えています...");
    if (DOM.questionBlock) DOM.questionBlock.style.display = "block";
    disableStep2Buttons(true);

    const payload = {
      flow: "nextQuestion",
      eventCategory: appState.eventCategory,
      summary: appState.summary,
      basicInfo: appState.basicInfo,
      qaLog: appState.qaLog,
    };

    const res = await callApi(payload);
    if (!res.ok) {
      throw new Error(res.error || "質問の取得に失敗しました。");
    }

    if (res.done) {
      appState.currentQuestion = null;
      appState.allQuestionsDone = true;
      setDialogueHint("質問は以上です。この内容で報告文を作成できます。");
      renderCurrentQuestion(null);
      if (DOM.generateReportButton) DOM.generateReportButton.disabled = false;

      // 事実ベース本文を先に構築しておく
      appState.facilityReportText = generateFacilityReportText(
        appState.basicInfo,
        appState.summary,
        appState.qaLog
      );
      return;
    }

    // 新しい質問
    appState.currentQuestion = res.question;
    appState.allQuestionsDone = false;
    if (DOM.generateReportButton) DOM.generateReportButton.disabled = true;

    // ログに質問を追加
    appendDialogueQuestion(res.question.label);
    renderCurrentQuestion(res.question);
    setDialogueHint("AIからの質問に回答してください。");
  } catch (err) {
    console.error(err);
    setError(err.message || "次の質問の取得に失敗しました。");
  } finally {
    appState.isAskingQuestion = false;
    disableStep2Buttons(false);
  }
}

/* -----------------------------
 * 質問表示（選択肢＋ヒント）
 * --------------------------- */
function renderCurrentQuestion(question) {
  const optionsContainer = document.getElementById("questionOptionsContainer");
  const hintEl = document.getElementById("questionHint");
  if (!optionsContainer || !hintEl) return;

  optionsContainer.innerHTML = "";
  hintEl.textContent = "";

  if (!question) {
    if (DOM.questionFreeTextInput) {
      DOM.questionFreeTextInput.value = "";
      DOM.questionFreeTextInput.placeholder =
        "必要であれば補足を記入してください。";
    }
    return;
  }

  if (question.hintForBeginner) {
    hintEl.textContent = question.hintForBeginner;
  }

  if (
    question.answerType === "singleChoice" ||
    question.answerType === "multiChoice"
  ) {
    const isMulti = question.answerType === "multiChoice";
    (question.options || []).forEach((opt, index) => {
      const id = `qopt_${Date.now()}_${index}`;
      const wrapper = document.createElement("label");
      wrapper.className = "question-option";

      const input = document.createElement("input");
      input.type = isMulti ? "checkbox" : "radio";
      input.name = "questionOptions";
      input.value = opt;
      input.id = id;

      const span = document.createElement("span");
      span.textContent = opt;

      wrapper.appendChild(input);
      wrapper.appendChild(span);
      optionsContainer.appendChild(wrapper);
    });

    if (DOM.questionFreeTextInput) {
      DOM.questionFreeTextInput.placeholder =
        question.allowFreeText === false
          ? "補足があれば記入してください（任意）"
          : "その他・補足があれば記入してください";
      DOM.questionFreeTextInput.disabled = false;
      DOM.questionFreeTextInput.value = "";
    }
  } else {
    // freeText 質問
    if (DOM.questionFreeTextInput) {
      DOM.questionFreeTextInput.placeholder = "ここに回答を記入してください";
      DOM.questionFreeTextInput.disabled = false;
      DOM.questionFreeTextInput.value = "";
    }
  }
}

/* -----------------------------
 * 回答送信
 * --------------------------- */
async function submitCurrentAnswer() {
  clearError();

  const q = appState.currentQuestion;
  if (!q) {
    alert("現在回答すべき質問がありません。");
    return;
  }

  const optionsContainer = document.getElementById("questionOptionsContainer");
  let selectedOptions = [];
  let freeText = "";

  if (q.answerType === "singleChoice" || q.answerType === "multiChoice") {
    if (optionsContainer) {
      const inputs = optionsContainer.querySelectorAll(
        "input[type=radio],input[type=checkbox]"
      );
      inputs.forEach((input) => {
        if (input.checked) selectedOptions.push(input.value);
      });
    }
    if (DOM.questionFreeTextInput && DOM.questionFreeTextInput.value.trim()) {
      freeText = DOM.questionFreeTextInput.value.trim();
    }
    if (selectedOptions.length === 0 && !freeText) {
      alert("少なくとも1つ選択するか、自由入力欄に記載してください。");
      return;
    }
  } else {
    // freeText
    if (DOM.questionFreeTextInput) {
      freeText = DOM.questionFreeTextInput.value.trim();
    }
    if (!freeText) {
      alert("回答を入力してください。");
      return;
    }
  }

  // qaLog に追加
  appState.qaLog.push({
    questionId: q.id,
    questionText: q.label,
    answerType: q.answerType,
    selectedOptions,
    freeText,
  });

  // ログに職員の回答を表示
  const answerTextParts = [];
  if (selectedOptions.length > 0) {
    answerTextParts.push(selectedOptions.join("／"));
  }
  if (freeText) {
    answerTextParts.push(freeText);
  }
  appendDialogueAnswer(answerTextParts.join(" ／ "));

  // 入力クリア
  if (DOM.questionFreeTextInput) DOM.questionFreeTextInput.value = "";
  if (optionsContainer) optionsContainer.innerHTML = "";

  // 次の質問
  await fetchNextQuestion();
}

/* -----------------------------
 * STEP3: fullEvaluate を呼び出す
 * --------------------------- */
async function generateAndEvaluateReport() {
  try {
    clearError();

    if (!appState.allQuestionsDone) {
      const ok = confirm(
        "AIヒアリングが完了していません。このままの情報で報告文を作成しますか？"
      );
      if (!ok) return;
    }

    saveStep1();
    appState.summary =
      DOM.summaryInput?.value?.trim() || appState.summary || "";

    const reportText =
      appState.facilityReportText ||
      generateFacilityReportText(
        appState.basicInfo,
        appState.summary,
        appState.qaLog
      );
    appState.facilityReportText = reportText;

    appState.isEvaluating = true;
    setDialogueHint("報告文を整えています...");
    disableStep2Buttons(true);
    if (DOM.generateReportButton) DOM.generateReportButton.disabled = true;

    const payload = {
      flow: "fullEvaluate",
      eventCategory: appState.eventCategory,
      basicInfo: appState.basicInfo,
      summary: appState.summary,
      qaLog: appState.qaLog,
      reportText,
    };

    const res = await callApi(payload);
    if (!res.ok) {
      throw new Error(res.error || "報告文の評価に失敗しました。");
    }

    appState.evaluationResult = res;
    renderEvaluationResult(res);
    setDialogueHint("報告文の生成とフィードバックが完了しました。");
  } catch (err) {
    console.error(err);
    setError(err.message || "報告文の作成・評価に失敗しました。");
  } finally {
    appState.isEvaluating = false;
    disableStep2Buttons(false);
    if (DOM.generateReportButton) DOM.generateReportButton.disabled = false;
  }
}

/* -----------------------------
 * 事実ベースの本文生成
 * --------------------------- */
function generateFacilityReportText(basicInfo, summary, qaLog) {
  const lines = [];

  const author = basicInfo.authorName || "";
  const target = basicInfo.targetPerson || "";
  const datetime = basicInfo.datetime || "";
  const place = basicInfo.place || "";
  const v = basicInfo.vitals || {};

  const hasAnyVitals =
    v.bt || v.bpSys || v.bpDia || v.pulse || v.spo2;

  lines.push("■概要");
  lines.push(summary || "（概要未入力）");
  lines.push("");

  lines.push("■基本情報");
  lines.push(`・作成者：${author || "（未入力）"}`);
  lines.push(`・対象利用者：${target || "（未入力）"}`);
  lines.push(`・日時：${datetime || "（未入力）"}`);
  lines.push(`・発生場所：${place || "（未入力）"}`);
  lines.push("");

  if (hasAnyVitals) {
    lines.push("■バイタル");
    if (v.bt) lines.push(`・体温：${v.bt}`);
    if (v.bpSys || v.bpDia) {
      lines.push(`・血圧：${v.bpSys || "?"} / ${v.bpDia || "?"} mmHg`);
    }
    if (v.pulse) lines.push(`・脈拍：${v.pulse} 回/分`);
    if (v.spo2) lines.push(`・SpO₂：${v.spo2} %`);
    lines.push("");
  }

  lines.push("■経過・補足情報");
  if (qaLog.length === 0) {
    lines.push("（AIヒアリングによる追加情報なし）");
  } else {
    qaLog.forEach((qa, index) => {
      const qText = qa.questionText || `質問${index + 1}`;
      const answers = [];
      if (qa.selectedOptions && qa.selectedOptions.length > 0) {
        answers.push(qa.selectedOptions.join("／"));
      }
      if (qa.freeText) {
        answers.push(qa.freeText);
      }
      lines.push(`・${qText}`);
      if (answers.length > 0) {
        lines.push(`　→ ${answers.join(" ／ ")}`);
      }
    });
  }
  lines.push("");

  lines.push("■現時点の状態");
  lines.push("（AIヒアリングで得られた情報をもとに、現場で追記してください）");
  lines.push("");

  lines.push("■実施した対応");
  lines.push("（実施済みの対応があれば具体的に記載してください。なければ『現時点で特別な対応は実施していません』など。）");
  lines.push("");

  lines.push("■今後の観察・報告ライン");
  lines.push("（観察のポイントや、誰に・どのタイミングで報告するかを記載してください）");
  lines.push("");

  return lines.join("\n");
}

/* -----------------------------
 * 評価結果の反映
 * --------------------------- */
function renderEvaluationResult(result) {
  if (DOM.localScoreValue) {
    DOM.localScoreValue.textContent =
      typeof result.score === "number" ? result.score : "-";
  }

  if (DOM.localScoreLevel) {
    let level = "報告の内容が評価されました。";
    if (typeof result.score === "number") {
      if (result.score >= 85) level = "とても情報がそろっており、わかりやすい報告です。";
      else if (result.score >= 70) level = "概ね必要な情報がそろっています。";
      else if (result.score >= 50) level = "重要な情報はありますが、追記するとより安心です。";
      else level = "必要な情報が不足している可能性があります。フィードバックを参考に追記してください。";
    }
    DOM.localScoreLevel.textContent = level;
  }

  if (DOM.localScoreDetail) {
    DOM.localScoreDetail.textContent = result.managerFeedback || "";
  }

  if (DOM.generatedReport) {
    DOM.generatedReport.textContent =
      result.improvedFacilityText || appState.facilityReportText || "";
  }

  if (DOM.aiFeedback) {
    DOM.aiFeedback.textContent = result.managerFeedback || "";
  }

  if (DOM.educationText) {
    DOM.educationText.value = result.keyPoints || "";
  }

  if (DOM.aiRewriteCard && DOM.aiRewriteText) {
    DOM.aiRewriteText.value =
      result.improvedFacilityText || appState.facilityReportText || "";
    DOM.aiRewriteCard.style.display = "block";
  }

  if (DOM.aiShortCard && DOM.aiShortText) {
    DOM.aiShortText.value = result.shortShiftNote || "";
    DOM.aiShortCard.style.display = "block";
  }

  if (DOM.doctorSummaryCard && DOM.doctorSummaryText) {
    DOM.doctorSummaryText.value = result.doctorSummary || "";
    DOM.doctorSummaryCard.style.display = "block";
  }
}

/* -----------------------------
 * Dialogue ログ表示
 * --------------------------- */
function appendDialogueQuestion(text) {
  if (!DOM.dialogueLog) return;
  const item = document.createElement("div");
  item.className = "dialogue-item";

  const q = document.createElement("div");
  q.className = "dialogue-q";
  const label = document.createElement("span");
  label.className = "dialogue-q-label";
  label.textContent = "AI：";
  const content = document.createElement("span");
  content.textContent = text;
  q.appendChild(label);
  q.appendChild(content);

  item.appendChild(q);
  DOM.dialogueLog.appendChild(item);
  DOM.dialogueLog.scrollTop = DOM.dialogueLog.scrollHeight;
}

function appendDialogueAnswer(text) {
  if (!DOM.dialogueLog) return;
  const item = document.createElement("div");
  item.className = "dialogue-item";

  const a = document.createElement("div");
  a.className = "dialogue-a";
  const label = document.createElement("span");
  label.className = "dialogue-a-label";
  label.textContent = "職員：";
  const content = document.createElement("span");
  content.textContent = text;
  a.appendChild(label);
  a.appendChild(content);

  item.appendChild(a);
  DOM.dialogueLog.appendChild(item);
  DOM.dialogueLog.scrollTop = DOM.dialogueLog.scrollHeight;
}

function appendDialogueSystem(text) {
  if (!DOM.dialogueLog) return;
  const item = document.createElement("div");
  item.className = "dialogue-item";

  const q = document.createElement("div");
  q.className = "dialogue-q";
  const label = document.createElement("span");
  label.className = "dialogue-q-label";
  label.textContent = "AI（お知らせ）：";
  const content = document.createElement("span");
  content.textContent = text;
  q.appendChild(label);
  q.appendChild(content);

  item.appendChild(q);
  DOM.dialogueLog.appendChild(item);
  DOM.dialogueLog.scrollTop = DOM.dialogueLog.scrollHeight;
}

/* -----------------------------
 * UIヘルパ
 * --------------------------- */
function setDialogueHint(text) {
  if (DOM.dialogueHint) {
    DOM.dialogueHint.textContent = text || "";
  }
}

function disableStep2Buttons(disabled) {
  if (DOM.startQuestionsButton) DOM.startQuestionsButton.disabled = disabled;
  if (DOM.submitAnswerButton) DOM.submitAnswerButton.disabled = disabled;
  // 完了ボタンは別制御
}

function setError(msg) {
  console.error(msg);
  if (DOM.errorMessage) {
    DOM.errorMessage.textContent = msg;
    DOM.errorMessage.style.display = "block";
  } else {
    alert(msg);
  }
}

function clearError() {
  if (DOM.errorMessage) {
    DOM.errorMessage.textContent = "";
    DOM.errorMessage.style.display = "none";
  }
}

function copyToClipboard(text, successMessage) {
  if (!text) {
    alert("コピーする内容がありません。");
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => {
        if (successMessage) alert(successMessage);
      },
      () => {
        alert("コピーに失敗しました。");
      }
    );
  } else {
    // フォールバック
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      if (successMessage) alert(successMessage);
    } catch (err) {
      alert("コピーに失敗しました。");
    }
    document.body.removeChild(textarea);
  }
}

/* -----------------------------
 * API呼び出し
 * --------------------------- */
async function callApi(payload) {
  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("API error:", res.status, text);
    return { ok: false, error: `APIエラー (${res.status})` };
  }

  try {
    return await res.json();
  } catch (err) {
    console.error("JSON parse error:", err);
    return { ok: false, error: "サーバからの応答を読み取れませんでした。" };
  }
}
