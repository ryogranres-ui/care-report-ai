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
  // ---------- 共有・報告モード ----------
  report: {
    name: "共有・報告モード",
    description:
      "事故・状態変化・申し送りなど、現場から管理者・看護師への「共有・報告」に使います。",
    labels: {
      summary: "概要（何が起きたか一文で）",
      details: "詳しい状況・経過（前後の様子）",
      actions: "実施した対応",
      goal: "今後の観察ポイント・共有しておきたいこと"
    },
    hints: {
      userName:
        "誰のことかが部署内で分かる表現で記載してください。例：伊藤洋子様、A様（2F東）、B様（ショート）など。",
      eventDateTime:
        "発生した日時を入力します。発見が遅れた場合は本文に「◯時に発生、◯時に発見」のように書き分けてください。",
      eventPlace:
        "どのフロア・どの場所かが他職員にも伝わるように書きます。例：2階食堂入口付近、1階トイレ前 など。",
      summary:
        "いつ・どこで・誰が・どうなったかを一文でまとめます。例：「昼食後の2階食堂で、A様が立ち上がり時に転倒された。」",
      details:
        "①発生前の状態 ②きっかけ ③発生時の様子 ④その後の経過 ⑤現在の状態 の順に書くと、第三者にも伝わりやすくなります。",
      actions:
        "測定したこと・行った処置・誰に報告したかを、「いつ・誰が・何をしたか」で整理して書いてください（例：14:30 介護職○○がバイタル測定、看護師△△へ報告 など）。",
      goal:
        "このあと現場にお願いしたい観察ポイントや、再度報告してほしい条件を書きます（例：今夜は2時間ごとに状態確認し、転倒や嘔吐があれば看護師へ報告）。",
      vital:
        "体温・血圧・脈拍・SpO2など、測定したものがあれば入力してください。未測定の項目は空欄でOKです。",
      concern:
        "「いつもより会話が少ない」「なんとなく元気がない」など、客観的に書きにくい違和感も、判断材料として重要です。感じたことをそのまま書いてください。"
    },
    checks: [
      { key: "summary", label: "概要", required: true },
      { key: "details", label: "詳しい状況・経過", required: true },
      { key: "actions", label: "実施した対応", required: true },
      { key: "goal", label: "今後の観察ポイント・共有しておきたいこと", required: false },
      { key: "vital", label: "バイタル／数値情報", required: false }
    ]
  },

  // ---------- 指示モード ----------
  instruction: {
    name: "指示モード",
    description:
      "看護師・管理者・リーダーが、介護職員などに「誤解なく動いてほしい指示」を出すときに使います。",
    labels: {
      summary: "指示の概要（誰に／何についてしてほしいか）",
      details: "背景・理由（なぜこの指示が必要か）",
      actions: "具体的な指示内容（いつ・誰が・どこで・何を・どの程度）",
      goal: "完了条件・報告ライン"
    },
    hints: {
      userName:
        "指示の対象となる利用者・ユニット・担当者などを書きます。例：A様、2F東フロア夜勤者、ショート利用者全般 など。",
      eventDateTime:
        "指示を実施してほしい期間や時間帯を書きます。例：本日夜勤帯、今週いっぱい、3月末まで など。",
      eventPlace:
        "どのフロア・どの場面で実施してほしい指示かを書きます。例：2階食堂での食事介助時、夜勤帯の巡視時 など。",
      summary:
        "『誰に』『何について』してほしいかを一文でまとめます。例：「2階日勤介護職へ、A様の水分量チェックの強化を依頼。」",
      details:
        "最近の状態変化・リスク・医師の指示など、この指示を出す理由を書きます（例：転倒が続いている、水分摂取量が少ない、医師より◯◯の指示があった など）。",
      actions:
        "①誰が　②いつ／どの時間帯に　③どの場面で　④何を　⑤どの程度　⑥してはいけないこと　を箇条書きにすると誤解が減ります。",
      goal:
        "どの状態になれば指示完了とするか、どのタイミングで誰に報告してほしいかを書きます。例：「3日間転倒がなければ指示終了とし、結果を看護師へ口頭報告。」",
      vital:
        "指示に関係する数値（体温・血圧・食事量・水分量・排泄回数など）があれば記載すると、現場が判断しやすくなります。",
      concern:
        "特に注意してほしいリスクや、『ここが悪化したらすぐ連絡してほしい』ポイントを書きます。例：SpO2 92％未満になったら即報告 など。"
    },
    checks: [
      { key: "summary", label: "指示の概要", required: true },
      { key: "details", label: "背景・理由", required: true },
      { key: "actions", label: "具体的な指示内容", required: true },
      { key: "goal", label: "完了条件・報告ライン", required: true }
    ]
  }
};

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
  setHint("hint-summary", "summary");
  setHint("hint-details", "details");
  setHint("hint-actions", "actions");
  setHint("hint-goal", "goal");
  setHint("hint-vital", "vital");
  setHint("hint-concern", "concern"); 
}

modeSelect.addEventListener("change", () => {
  applyMode(modeSelect.value);
  // モード切替時にローカルスコアをリセット
  localScoreValueEl.textContent = "—";
  localScoreLevelEl.textContent = "未評価";
  localScoreDetailEl.textContent =
    "フォームに入力すると、自動的に不足している視点をお知らせします。";
});

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

