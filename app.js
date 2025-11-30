// Care Report AI クライアント側ロジック

document.addEventListener("DOMContentLoaded", () => {
  const generateBtn = document.getElementById("generate-btn");
  const outputArea = document.getElementById("report-output");

  const scoreNumberEl = document.getElementById("score-number");
  const scoreLevelEl = document.getElementById("score-level");
  const scoreCommentEl = document.getElementById("score-comment");

  if (!generateBtn) return;

  generateBtn.addEventListener("click", async () => {
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

    if (outputArea) {
      outputArea.value = reportText;
    }

    // ── まずはローカルロジックでスコア＆フィードバック表示（即レスポンス用） ──
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

    if (scoreNumberEl) {
      scoreNumberEl.textContent = String(scoreResult.score);
    }

    const feedback = getScoreFeedback(scoreResult);

    if (scoreLevelEl) {
      scoreLevelEl.textContent = `レベル：${feedback.levelLabel}`;
    }
    if (scoreCommentEl) {
      scoreCommentEl.textContent =
        feedback.comment + "\n\nAIによる詳細フィードバックを生成中です…";
    }

    // ── ここから AI API を呼んで、結果で上書き ──
    try {
      const apiUrl = "/api/evaluate-report";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          fields: {
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
          },
        }),
      });

      if (!res.ok) {
        console.error("AI API error", res.status);
        if (scoreCommentEl) {
          scoreCommentEl.textContent =
            feedback.comment +
            "\n\n※ AI 連携でエラーが発生したため、ローカル版フィードバックのみ表示しています。";
        }
        return;
      }

            const data = await res.json();

      // サーバー側でエラーを検知した場合
      if (data && data.error) {
        console.error("AI API returned error", data);
        if (scoreCommentEl) {
          scoreCommentEl.textContent =
            feedback.comment +
            `\n\n※ AI 連携でエラーが発生しました（${data.error}${
              data.status ? `: ${data.status}` : ""
            }）。`;
        }
        return;
      }

      if (typeof data.score === "number" && scoreNumberEl) {
        scoreNumberEl.textContent = String(data.score);
      }
      if (data.levelLabel && scoreLevelEl) {
        scoreLevelEl.textContent = `レベル：${data.levelLabel}`;
      }
      if (data.comment && scoreCommentEl) {
        scoreCommentEl.textContent = data.comment;
      }

      if (data.rewriteExample) {
        console.log("AI 書き直し案:\n", data.rewriteExample);
      }

      // 書き直し案はまずコンソールに出す。UIに載せたくなったらあとでボックス作ろう
      if (data.rewriteExample) {
        console.log("AI 書き直し案:\n", data.rewriteExample);
      }
    } catch (err) {
      console.error("AI fetch error", err);
      if (scoreCommentEl) {
        scoreCommentEl.textContent =
          feedback.comment +
          "\n\n※ AI 連携に失敗したため、ローカル版フィードバックのみ表示しています。";
      }
    }
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

  // ★ 出力には「名前だけ」出す（立場は出さない）
  const reporterPart = (() => {
    const name = (data.reporterName || "").trim();
    if (!name) return "";
    return `報告者：${name}`;
  })();

  if (reporterPart) {
    lines.push(`● ${reporterPart}`);
  }

  if (data.when || data.where) {
    lines.push(
      `● 発生日時・場所：${fallback(data.when)}　／　${fallback(
        data.where
      )}`
    );
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
    vitalParts.push(
      `血圧 ${fallback(data.bpSys)} / ${fallback(data.bpDia)} mmHg`
    );
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

function hasText(value) {
  return value != null && String(value).trim().length > 0;
}

/**
 * スコア計算（状況に応じて「どこで」「バイタル」を見直し）
 */
function calcScore(fields) {
  const missing = [];
  const strengths = [];
  const improvements = [];
  let gained = 0;
  let maxWeight = 0;

  function addMandatory(weight, filled, label, strengthMsg, improveMsg) {
    maxWeight += weight;
    if (filled) {
      gained += weight;
      if (strengthMsg) strengths.push(strengthMsg);
    } else {
      missing.push(label);
      if (improveMsg) improvements.push(improveMsg);
    }
  }

  function addOptional(weight, filled, strengthMsg) {
    if (filled) {
      maxWeight += weight;
      gained += weight;
      if (strengthMsg) strengths.push(strengthMsg);
    }
  }

  // 体調・転倒など → バイタル重要
  const textForVitalsCheck = [fields.what, fields.state, fields.goalDetail]
    .filter(Boolean)
    .join(" ");
  const vitalsImportant = /熱|発熱|体調|具合|痛み|痛い|転倒|ころん|出血|怪我|けが|呼吸|息|SpO2|ＳｐＯ２|酸素|嘔吐|吐|下痢|食欲|食事|水分|むくみ/i.test(
    textForVitalsCheck
  );

  // 電話・連絡・メール中心かどうか
  const textForLocationCheck = [fields.what, fields.goalDetail]
    .filter(Boolean)
    .join(" ");
  const locationImportant = !/電話|TEL|tel|連絡|メール|LINE/i.test(
    textForLocationCheck
  );

  // 何が起きたか
  addMandatory(
    20,
    hasText(fields.what),
    "何が起きたか（事象）",
    "何が起きたかが具体的に書けています。",
    "「誰が・何を・どうしたか」が分かるように、一文にまとめてみましょう。"
  );

  // いつ
  addMandatory(
    15,
    hasText(fields.when),
    "いつ（時間・タイミング）",
    "起きた時間やタイミングが分かりやすいです。",
    "「今日の◯時ごろ」「◯月◯日△時」など、具体的な時間を書くとイメージしやすくなります。"
  );

  // どこで
  if (locationImportant) {
    addMandatory(
      10,
      hasText(fields.where),
      "どこで（場所）",
      "場所が書かれているので、状況がイメージしやすいです。",
      "現場での出来事の場合は「居室・食堂・廊下」など、場所も一緒に書いておきましょう。"
    );
  } else {
    // 電話・連絡中心 → あればプラス評価のみ
    addOptional(
      5,
      hasText(fields.where),
      "電話・連絡中心の報告ですが、場所も書かれていて丁寧です。"
    );
  }

  // 誰が
  addMandatory(
    15,
    hasText(fields.who),
    "誰が（対象者）",
    "対象者が明確で、誰のことかがすぐ分かります。",
    "利用者様のお名前（イニシャルでも可）を書いて、誰のことか分かるようにしましょう。"
  );

  // 状態・バイタル
  const hasStateText = hasText(fields.state);
  const hasAnyVital = [
    fields.bpSys,
    fields.bpDia,
    fields.pulse,
    fields.spo2,
    fields.temp,
  ].some(hasText);

  if (vitalsImportant) {
    // 体調・転倒など → 状態＋バイタルを必須扱い
    addMandatory(
      15,
      hasStateText && hasAnyVital,
      "今の状態・バイタル",
      "体調に関する報告なので、状態とバイタルが書かれていて安心です。",
      "体調の変化がテーマのときは、状態の様子に加えて血圧・体温・脈拍・SpO₂ など分かる範囲で書いておきましょう。"
    );
  } else {
    // 体調以外の話題 → 書いてあればプラス評価だけ
    addOptional(
      10,
      hasStateText || hasAnyVital,
      "今の状態やバイタルも添えてあり、読み手が状況をイメージしやすくなっています。"
    );
  }

  // あなたの対応
  addMandatory(
    15,
    hasText(fields.action),
    "あなたの対応",
    "あなたがどのように対応したかが書かれており、判断の参考になります。",
    "あなたが行った対応を、時系列で 1〜2 文にまとめて書いてみましょう。"
  );

  // ゴール
  const hasGoalText = hasText(fields.goalKind) || hasText(fields.goalDetail);
  addMandatory(
    15,
    hasGoalText,
    "報告のゴール（相手にしてほしいこと）",
    "相手にどうしてほしいかが書かれていて、読み手が動きやすくなっています。",
    "「◯◯してほしい」「◯◯を確認してほしい」など、相手にしてほしい行動をはっきり書いてみましょう。"
  );

  if (maxWeight === 0) {
    return {
      score: 0,
      missing,
      strengths,
      improvements,
      vitalsImportant,
      locationImportant,
    };
  }

  const finalScore = Math.max(
    0,
    Math.min(100, Math.round((gained / maxWeight) * 100))
  );

  return {
    score: finalScore,
    missing,
    strengths,
    improvements,
    vitalsImportant,
    locationImportant,
  };
}

/**
 * スコアに応じたレベル・コメント生成（AI風フィードバック）
 */
function getScoreFeedback(result) {
  const {
    score,
    missing,
    strengths,
    improvements,
    vitalsImportant,
    locationImportant,
  } = result;

  let levelLabel;
  let baseComment;

  if (score >= 90) {
    levelLabel = "Lv.3 ほぼ完成形の報告";
    baseComment =
      "主要な情報がしっかり揃っていて、とても伝わりやすい報告です。このまま現場でも通用するレベルです。";
  } else if (score >= 75) {
    levelLabel = "Lv.2 要点は押さえられている";
    baseComment =
      "大事なポイントは概ね書けています。あと 1〜2 箇所だけ具体的にすると、さらに伝わりやすくなります。";
  } else {
    levelLabel = "Lv.1 まずは型になれる段階";
    baseComment =
      "まだ埋めきれていない項目があります。「何が・いつ・どこで・誰に・どうしてほしいか」を意識して、一つずつ埋めていきましょう。";
  }

  const totalImportant =
    1 + // what
    1 + // when
    (locationImportant ? 1 : 0) +
    1 + // who
    1 + // action
    1 + // goal
    (vitalsImportant ? 1 : 0);

  const filledImportant = totalImportant - missing.length;

  let summary = `大事な項目（${totalImportant} 項目）のうち、${filledImportant} 項目が書けています。`;
  if (missing.length === 0) {
    summary +=
      " 今回の内容なら、このままでも十分伝わります。余裕があれば、もう一文だけ具体的な説明を足してみましょう。";
  } else {
    summary +=
      " 特に「" +
      missing.join("」「") +
      "」が抜けやすいので、次回はここを一文だけ補ってみましょう。";
  }

  const goodList =
    strengths.length > 0
      ? strengths.slice(0, 3).map((s) => "・" + s).join("\n")
      : "・まずは書き始められているのが素晴らしいです。少しずつ項目を増やしていきましょう。";

  const improveList =
    improvements.length > 0
      ? improvements.slice(0, 3).map((s) => "・" + s).join("\n")
      : "・大きな抜けはありません。余裕があれば、もう一文だけ具体的な状況説明を追加してみましょう。";

  const comment =
    baseComment +
    "\n\n" +
    summary +
    "\n\n【良かったところ】\n" +
    goodList +
    "\n\n【次に足してみると良いところ】\n" +
    improveList;

  return { levelLabel, comment };
}
