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
      "事故・状態変化・申し送りなど、現場から管理者・看護師への「共有・報告」に使います。",
    labels: {
      summary: "概要（ひとことで言うと？）",
      details: "詳しい状況・経過",
      actions: "実施した対応",
      goal: "今後の対応・ゴール／報告ライン"
    },
    placeholders: {
      summary: "例）居室前の廊下で転倒し、右膝を打撲された。意識は清明。",
      details:
        "例）転倒前の様子、きっかけ、転倒した瞬間の状況、転倒直後の訴えなどを時系列で記載します。",
      actions:
        "例）バイタル測定、患部のアイシング、看護師へ報告、家族へ状況説明 など",
      goal:
        "例）今夜は2時間ごとに状態確認し、頭痛・吐き気・歩行時のふらつきがあれば看護師に報告する。"
    },
    hints: {
      userName:
        "利用者名はフルネームでなくても、施設内で誰か特定できる表現であればOKです。",
      eventDateTime:
        "発生時刻と発見時刻が違う場合は、本文中で区別して書けるとより正確です。",
      eventPlace:
        "フロア・部屋番号・どのあたりか（入口付近など）を書くと、再発防止に役立ちます。",
      summary:
        "「いつ・どこで・誰に・何が起きたか」を一文でまとめます。後から読み返した時に状況が一瞬でイメージできることがゴールです。",
      details:
        "直前の様子 → きっかけ → 起きたこと → その直後の反応の順で書くと、管理者が状況を追いやすくなります。",
      actions:
        "「誰が・いつ・何をしたか」を整理して書きます。観察だけでも立派な対応なので『観察のみ』も正直に記載しましょう。",
      goal:
        "今後の観察ポイント（どんな変化があれば再連絡するか）と、誰に報告してほしいかを書きます。",
      vital:
        "体温・血圧・脈拍・SpO2など、測定したものだけでOKです。測定していない項目は空欄で問題ありません。",
      concern:
        "「なんとなくいつもと違う」「表情が固い」など、言葉にしづらい違和感もそのまま書いてください。判断のヒントになります。"
    },
    checks: [
      { key: "summary", label: "概要", required: true },
      { key: "details", label: "詳しい状況・経過", required: true },
      { key: "actions", label: "実施した対応", required: true },
      { key: "goal", label: "今後の対応・ゴール／報告ライン", required: false },
      { key: "vital", label: "バイタル／数値情報", required: false }
    ]
  },

  // -------------------------
  // 指示モード
  // -------------------------
  instruction: {
    name: "指示モード",
    description:
      "看護師・管理者・リーダーが、介護職員などに「誤解なく動いてほしい指示」を出すときに使います。",
    labels: {
      summary: "指示の概要（誰に／何についてしてほしいか）",
      details: "背景・理由（なぜ必要か？）",
      actions: "具体的な指示内容（いつ・誰が・どこで・何を・どの程度）",
      goal: "完了条件・報告ライン"
    },
    placeholders: {
      summary:
        "例）日勤帯の介護職員へ、A様の水分摂取量のチェックを強化してほしい。",
      details:
        "例）最近の状態変化やリスク、医師・家族からの要望など、なぜこの指示が必要なのかを記載します。",
      actions:
        "例）早番と日勤の介護職員が、9〜17時の間に2時間ごとに水分量を確認し、記録用紙に○○ml単位で記載する。",
      goal:
        "例）1日1500ml以上の摂取が3日間続いたら指示完了とし、達成できない日が続く場合は看護師に報告する。"
    },
    hints: {
      userName:
        "指示の対象となる利用者／対象者を書きます。複数いる場合は「◯◯様ほか◯名」などでもOKです。",
      eventDateTime:
        "いつからいつまで行ってほしい指示か、開始日や期間の目安が分かるように書くと動きやすくなります。",
      eventPlace:
        "どのフロア／どの時間帯の担当者が行う指示かが分かるように書くと、担当の抜け漏れを防げます。",
      summary:
        "『誰に』『何の件で』『どうしてほしいか』を一文でまとめます。読む人が一瞬で「何の指示か」分かることがゴールです。",
      details:
        "状態悪化のサイン・最近のトラブル・医師指示など、背景が分かると現場が優先度を判断しやすくなります。",
      actions:
        "①誰が ②いつ ③どこで ④何を ⑤どのくらい行うのかを具体的に書きます。「必要に応じて」「適宜」はできるだけ避けましょう。",
      goal:
        "どの状態になったら指示完了とするか、どのタイミングで・誰に報告してほしいかを明確にします。",
      vital:
        "指示に関係する数値（体温・血圧・食事量・水分量・排便回数など）があれば記載してください。なければ空欄でOKです。",
      concern:
        "指示を実行するにあたって注意してほしいリスク（転倒・窒息・誤薬など）や、特に気をつけて見てほしい悪化サインを書きます。"
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

