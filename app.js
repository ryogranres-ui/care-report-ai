// ===== 設定 =====
const API_ENDPOINT = "/api/evaluate-report";

// ===== DOM取得 =====
const el = (id) => document.getElementById(id);

const modeSelect = el("modeSelect");
const modeDescription = el("modeDescription");

const reporterNameInput = el("reporterName");
const userNameInput = el("userName");
const eventDateTimeInput = el("eventDateTime");
const eventPlaceInput = el("eventPlace");
const summaryInput = el("summary");
const detailsInput = el("details");
const actionsInput = el("actions");
const goalInput = el("goal");
const concernInput = el("concern");

// 新カード関連
const aiRewriteCard = document.getElementById("aiRewriteCard");
const aiRewriteText = document.getElementById("aiRewriteText");
const btnCopyRewrite = document.getElementById("btnCopyRewrite");
const btnApplyRewrite = document.getElementById("btnApplyRewrite");

// バイタル用
const tempInput = el("tempInput");
const bpSysInput = el("bpSysInput");
const bpDiaInput = el("bpDiaInput");
const pulseInput = el("pulseInput");
const spo2Input = el("spo2Input");

const generatedReportEl = el("generatedReport");
const localScoreValueEl = el("localScoreValue");
const localScoreLevelEl = el("localScoreLevel");
const localScoreDetailEl = el("localScoreDetail");

const aiScoreValueEl = el("aiScoreValue");
const aiFeedbackEl = el("aiFeedback");
const aiRewriteEl = el("aiRewrite");

const errorMessageEl = el("errorMessage");

// ボタン
const btnGenerate = document.getElementById("btnGenerate");
const btnEvaluate = document.getElementById("btnEvaluate");

// ===== モード定義 =====
const MODE_CONFIG = {
  // -------------------------
  // 共有・報告モード
  // -------------------------
 report: {
  name: "共有・報告モード",
  description:
    "体調・行動・出来事・家族連絡・設備・持ち物など、現場のあらゆる共有に使えるモードです。",

  labels: {
    summary: "概要（ひとことで言うと？）",
    details: "詳しい状況・経過（何があったのか？）",
    actions: "実施した対応",
    goal: "今後の対応・ゴール／報告ライン"
  },

  hints: {
    userName: "利用者名はフルネームでなくとも、施設内で誰か特定できればOKです。",
    eventDateTime: "発生時刻・発見時刻が異なる場合は、本文で区別して書くと正確です。",
    eventPlace: "フロア・部屋番号・どのあたりか（入口付近など）を書くと理解がスムーズです。",

    summary:
      "「何が起きたのか？」を一文でまとめます。体調以外の共有（家族連絡・物品・出来事など）でもOK。",

    details:
      "“いつ・どこで・誰が・何に気づいたか” など、状況を分かる範囲で書きます。見た／聞いた／起きた事実だけで十分です。",

    actions:
      "声かけ・観察・測定・説明・連絡・処置など、実施した内容を簡潔に書きます。未実施の場合は空欄でOK。",

    goal:
      "次にどうするか（観察ポイント・注意点・報告の基準など）をシンプルに書きます。１つだけでもOK。",

    vital:
      "測定していない項目は空欄でOKです。入力がある項目のみ文章に反映されます。",

    concern:
      "「なんとなく気になる」「いつもと違う」という感覚的情報も共有すると役立ちます。短くてOKです。"
  },

  checks: [
    { key: "summary", label: "概要", required: true },
    { key: "details", label: "詳しい状況・経過", required: true },
    { key: "actions", label: "実施した対応", required: false },
    { key: "goal", label: "今後の対応・ゴール／報告ライン", required: false },
    { key: "vital", label: "バイタル／数値情報", required: false }
  ]
}

  // -------------------------
  // 指示モード
  // -------------------------
 instruction: {
  name: "指示モード",
  description:
    "看護師・管理者・リーダーが、介護職員などに明確な指示を出すためのモードです。体調・生活面・ケア内容・家族対応など、どの事例にも使える汎用型の入力フォームです。",
  
  labels: {
    summary: "何の指示か？（ひとことで）",
    details: "背景・理由（なぜ必要か？）",
    actions: "具体的な指示内容（誰が・いつ・どこで・何を・どの程度）",
    goal: "完了条件・報告ライン"
  },

  hints: {
    userName:
      "指示の対象となる利用者・職員・場所を記載します（例：A様、フロア職員、夜勤者など）。",
    eventDateTime:
      "指示を実施してほしい期間・開始時刻・時間帯などが分かると動きやすいです。",
    eventPlace:
      "どのフロア・どの担当者が行う指示か分かるように書くと誤解が減ります。",
    summary:
      "指示の“主題”をひとことで。例：『B様の嘔吐後の観察強化』『A様の水分量チェック依頼』など。",
    details:
      "なぜ必要か？直近の状態変化・家族からの要望・医師の指示・環境要因などを簡潔に。",
    actions:
      "指示の中心部分。『誰が』『いつ』『どこで』『何を』『どの程度』を意識できると職員が迷いません。",
    goal:
      "どの状態になれば指示完了とみなすか、変化があれば誰に報告するかを書きます。",
    vital:
      "必要であれば、体温・血圧・摂取量・排泄量など指示に関連する数値を入力してください。",
    concern:
      "気になっている点（例：『表情乏しい』『返答が遅い』『食事量が落ちている』など）。判断の補助になります。"
  },

  // チェック項目（超シンプル）
  checks: [
    { key: "summary", label: "指示の概要", required: true },
    { key: "details", label: "背景・理由", required: true },
    {
      key: "actions",
      label: "具体的な指示内容（誰が・いつ・どこで・何を）",
      required: true
    },
    { key: "goal", label: "完了条件・報告ライン", required: true },
    { key: "vital", label: "バイタル／数値情報", required: false },
    { key: "concern", label: "気になっている点", required: false }
  ]
}

// ===== モード反映 =====
function applyMode(modeKey) {
  const mode = MODE_CONFIG[modeKey] ?? MODE_CONFIG.report;

  // モード説明
  modeDescription.textContent = `現在は「${mode.name}」です。${mode.description}`;

  // ラベル
  el("label-summary").textContent = mode.labels.summary;
  el("label-details").textContent = mode.labels.details;
  el("label-actions").textContent = mode.labels.actions;
  el("label-goal").textContent = mode.labels.goal;

  // プレースホルダー（例文）
  if (mode.placeholders) {
    if (mode.placeholders.summary) {
      summaryInput.placeholder = mode.placeholders.summary;
    }
    if (mode.placeholders.details) {
      detailsInput.placeholder = mode.placeholders.details;
    }
    if (mode.placeholders.actions) {
      actionsInput.placeholder = mode.placeholders.actions;
    }
    if (mode.placeholders.goal) {
      goalInput.placeholder = mode.placeholders.goal;
    }
  }

  // ヒント文
  const hints = mode.hints || {};
  const setHint = (id, key) => {
    const target = el(id);
    if (!target) return;
    target.textContent = hints[key] || "";
  };

  setHint("hint-userName", "userName");
  setHint("hint-eventDateTime", "eventDateTime");
  setHint("hint-eventPlace", "eventPlace");
  setHint("hint-summary", "summary");
  setHint("hint-details", "details");
  setHint("hint-actions", "actions");
  setHint("hint-goal", "goal");
  setHint("hint-vital", "vital");
  setHint("hint-concern", "concern");
}

// モード切替イベント
modeSelect.addEventListener("change", () => {
  applyMode(modeSelect.value);
  // モード切替時にローカルスコアをリセット
  localScoreValueEl.textContent = "—";
  localScoreLevelEl.textContent = "未評価";
  localScoreDetailEl.textContent =
    "フォームに入力すると、自動的に不足している視点をお知らせします。";
});

// 初期表示
applyMode(modeSelect.value);


// ===== 日時フォーマット =====
function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  return `${y}年${m}月${day}日 ${hh}時${mm}分頃`;
}

// ===== バイタル文字列作成 =====
function buildVital() {
  const t = tempInput.value;
  const sys = bpSysInput.value;
  const dia = bpDiaInput.value;
  const pulse = pulseInput.value;
  const spo2 = spo2Input.value;

  const parts = [];
  if (t) parts.push(`BT ${t}℃`);
  if (sys && dia) parts.push(`BP ${sys}/${dia}`);
  if (pulse) parts.push(`P ${pulse}`);
  if (spo2) parts.push(`SpO2 ${spo2}％`);

  return parts.join("、");
}
// ===== モード反映 =====
function applyMode(modeKey) {
  const mode = MODE_CONFIG[modeKey] ?? MODE_CONFIG.report;

  modeDescription.textContent = `現在は「${mode.name}」です。${mode.description}`;

  // ラベル
  el("label-summary").textContent = mode.labels.summary;
  el("label-details").textContent = mode.labels.details;
  el("label-actions").textContent = mode.labels.actions;
  el("label-goal").textContent = mode.labels.goal;

  // ヒント
  const hints = mode.hints || {};
  const setHint = (id, key) => {
    const target = el(id);
    if (!target) return;
    target.textContent = hints[key] || "";
  };

  setHint("hint-userName", "userName");
  setHint("hint-eventDateTime", "eventDateTime");
  setHint("hint-eventPlace", "eventPlace");
  setHint("hint-summary", "summary");
  setHint("hint-details", "details");
  setHint("hint-actions", "actions");
  setHint("hint-goal", "goal");
  setHint("hint-vital", "vital");
  setHint("hint-concern", "concern"); // ← 新規追加

  // プレースホルダ切り替え（例文）
  if (mode.placeholders) {
    summaryInput.placeholder = mode.placeholders.summary || "";
    detailsInput.placeholder = mode.placeholders.details || "";
    actionsInput.placeholder = mode.placeholders.actions || "";
    goalInput.placeholder = mode.placeholders.goal || "";
  }
}

// ===== 報告／指示文生成 =====
function buildReport(modeKey) {
  const mode = MODE_CONFIG[modeKey] ?? MODE_CONFIG.report;

  const reporter = reporterNameInput.value.trim();
  const user = userNameInput.value.trim();
  const dt = eventDateTimeInput.value;
  const place = eventPlaceInput.value.trim();
  const summary = summaryInput.value.trim();
  const details = detailsInput.value.trim();
  const actions = actionsInput.value.trim();
  const goal = goalInput.value.trim();
  const vital = buildVital();
  const concern = concernInput.value.trim();

  const rows = [];

  // ヘッダー
  rows.push(`【モード】${mode.name}`);

  // 概要
  if (summary) {
    rows.push(`\n■ ${mode.labels.summary}\n・${summary}`);
  }

  // 基本情報
  if (user || dt || place) {
    rows.push("\n■ 基本情報");
    if (user) rows.push(`・対象：${user}`);
    if (dt) rows.push(`・日時：${formatDateTime(dt)}`);
    if (place) rows.push(`・場所：${place}`);
  }

  // 詳細
  if (details) {
    rows.push(`\n■ ${mode.labels.details}\n・${details}`);
  }

  // バイタル
  if (vital) {
    rows.push(`\n■ バイタル／数値情報\n・${vital}`);
  }

  // 対応／指示内容
  if (actions) {
    rows.push(`\n■ ${mode.labels.actions}\n・${actions}`);
  }

  // 今後の対応／完了条件
  if (goal) {
    rows.push(`\n■ ${mode.labels.goal}\n・${goal}`);
  }

  // 違和感
  if (concern) {
    rows.push("\n■ 職員として感じた違和感・注意してほしい点\n・" + concern);
  }

  // 作成者
  if (reporter) {
    rows.push(`\n■ 作成者\n・${reporter}`);
  }

  return rows.join("\n");
}

// ===== ローカルスコア =====
function evaluateLocal(modeKey) {
  const mode = MODE_CONFIG[modeKey] ?? MODE_CONFIG.report;
  const checks = mode.checks || [];

  const values = {
    summary: summaryInput.value.trim(),
    details: detailsInput.value.trim(),
    actions: actionsInput.value.trim(),
    goal: goalInput.value.trim(),
    vital: buildVital()
  };

  let missingRequired = [];
  let missingOptional = [];

  for (const c of checks) {
    const v = (values[c.key] || "").trim();
    if (!v) {
      if (c.required) {
        missingRequired.push(c.label);
      } else {
        missingOptional.push(c.label);
      }
    }
  }

  let score = 100;
  score -= missingRequired.length * 20;
  score -= missingOptional.length * 8;
  if (score < 20) score = 20;
  if (score > 100) score = 100;

  const levelLabel =
    score >= 90
      ? "ほぼ完成レベル"
      : score >= 75
      ? "管理者が安心できるレベル"
      : score >= 60
      ? "大枠OK。もう一歩深掘りしたい"
      : "重要な情報が不足している可能性あり";

  localScoreValueEl.textContent = `${score}`;
  localScoreLevelEl.textContent = levelLabel;

  const messages = [];
  if (missingRequired.length) {
    messages.push(
      `【必ず書いておきたい項目】\n- ${missingRequired.join("\n- ")}`
    );
  }
  if (missingOptional.length) {
    messages.push(
      `【あるとより良い項目】\n- ${missingOptional.join("\n- ")}`
    );
  }
  localScoreDetailEl.textContent =
    messages.length > 0
      ? messages.join("\n\n")
      : "大きな抜けはありません。AIフィードバックで最終チェックを行いましょう。";

  return {
    score,
    missingRequired,
    missingOptional
  };
}

// ===== エラー表示 =====
function showError(message) {
  errorMessageEl.textContent = message;
  errorMessageEl.style.display = "block";
}

function clearError() {
  errorMessageEl.textContent = "";
  errorMessageEl.style.display = "none";
}

// ===== AI呼び出し =====
async function callAiEvaluate(payload) {
  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  // いったん JSON を取る（エラー時もメッセージを取りたい）
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // JSON で返ってこなかった場合はそのまま
  }

  if (!res.ok) {
    const message =
      (data && (data.errorMessage || data.error)) ||
      `AI評価APIでエラーが発生しました（${res.status}）`;
    throw new Error(message);
  }

  return data;
}

// ===== ① AI用の文章を作る =====
if (btnGenerate) {
  btnGenerate.addEventListener("click", (e) => {
    e.preventDefault();
    clearError();

    const modeKey = modeSelect.value;
    const reportText = buildReport(modeKey);

    // 黒枠に反映
    generatedReportEl.textContent = reportText;

    // ローカルスコア更新
    evaluateLocal(modeKey);

    // AI結果リセット
    aiScoreValueEl.textContent = "—";
    aiFeedbackEl.innerHTML = "";
    aiRewriteEl.textContent = "";

    if (aiRewriteCard && aiRewriteText) {
      aiRewriteCard.style.display = "none";
      aiRewriteText.value = "";
    }
  });
}

// ===== ② 管理者チェック（AI評価） =====
if (btnEvaluate) {
  btnEvaluate.addEventListener("click", async (e) => {
    e.preventDefault();
    clearError();

    const reportText = generatedReportEl.textContent.trim();
    if (!reportText) {
      showError("まず「① AI用の文章を作る」を押してから実行してください。");
      return;
    }

    const modeKey = modeSelect.value;
    const localInfo = evaluateLocal(modeKey);

    // ローディング表示
    aiScoreValueEl.textContent = "…";
    aiFeedbackEl.innerHTML = "<p>AIが内容を確認しています…</p>";
    aiRewriteEl.textContent = "";

    // 改善済み文章カードがあれば一旦隠す
    if (aiRewriteCard && aiRewriteText) {
      aiRewriteCard.style.display = "none";
      aiRewriteText.value = "";
    }

    try {
      const payload = {
        mode: modeKey,
        reportText,
        localScore: localInfo.score,
        missingRequired: localInfo.missingRequired,
        missingOptional: localInfo.missingOptional
      };

      const data = await callAiEvaluate(payload);

      const aiScore = data.aiScore ?? data.score ?? null;
      const feedbackText = data.feedbackText ?? data.feedback ?? "";
      const rewrite = data.rewriteText ?? data.rewrite ?? "";

      // ① スコア表示
      aiScoreValueEl.textContent = aiScore != null ? `${aiScore}` : "—";

      // ② フィードバック（指摘・改善ポイント）
      if (feedbackText) {
        aiFeedbackEl.innerHTML = feedbackText
          .split("\n")
          .map((line) => `<p>${line}</p>`)
          .join("");
      } else {
        aiFeedbackEl.innerHTML =
          "<p>AIからのフィードバックは取得できませんでした。</p>";
      }

      // ③ 書き直し例 → 新しい改善済み文章エリアに反映
      if (rewrite) {
        aiRewriteEl.textContent = rewrite;

        if (aiRewriteCard && aiRewriteText) {
          aiRewriteCard.style.display = "block";
          aiRewriteText.value = rewrite;
        }
      } else {
        aiRewriteEl.textContent = "";
        if (aiRewriteCard && aiRewriteText) {
          aiRewriteCard.style.display = "none";
          aiRewriteText.value = "";
        }
      }
    } catch (err) {
      console.error(err);
      aiScoreValueEl.textContent = "—";
      aiFeedbackEl.innerHTML = "";

      if (aiRewriteCard && aiRewriteText) {
        aiRewriteCard.style.display = "none";
        aiRewriteText.value = "";
      }

      showError(err.message || "AI評価中にエラーが発生しました。");
    }
  });
}

// ===== 改善済み文章：コピー =====
if (btnCopyRewrite && aiRewriteText) {
  btnCopyRewrite.addEventListener("click", () => {
    const text = aiRewriteText.value.trim();
    if (!text) return;

    navigator.clipboard.writeText(text).then(
      () => alert("改善済みの文章をコピーしました。"),
      () => alert("コピーに失敗しました。手動で選択してコピーしてください。")
    );
  });
}

// ===== 改善済み文章：AIに渡す文章（黒枠）に反映 =====
if (btnApplyRewrite && aiRewriteText) {
  btnApplyRewrite.addEventListener("click", () => {
    const text = aiRewriteText.value.trim();
    if (!text) return;

    generatedReportEl.textContent = text;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}

