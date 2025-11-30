// Care Report AI - フロント側ロジック（試作版）

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reportForm");
  const resultText = document.getElementById("resultText");
  const feedback = document.getElementById("feedback");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // 入力値を取得
    const stance = getValue("stance");
    const what = getValue("what");
    const when = getValue("when");
    const where = getValue("where");
    const who = getValue("who");
    const condition = getValue("condition");
    const action = getValue("action");
    const requestType = getValue("requestType");
    const requestDetail = getValue("requestDetail");

    const bpSys = getValue("bpSys");
    const bpDia = getValue("bpDia");
    const pulse = getValue("pulse");
    const spo2 = getValue("spo2");
    const temp = getValue("temp");

    // 必須チェック
    const missing = [];
    if (!what) missing.push("何が起きたか");
    if (!when) missing.push("いつ");
    if (!where) missing.push("どこで");
    if (!who) missing.push("誰が");
    if (!action) missing.push("どう対応したか");
    if (!requestDetail) missing.push("相手にしてほしいこと");

    if (missing.length > 0) {
      feedback.innerHTML =
        "⚠️ 次の項目が未入力です：" + missing.join(" / ");
      feedback.className = "feedback feedback__warn";
      // それでも文章は作る（学習用）
    } else {
      feedback.innerHTML =
        "✅ 主要な項目は埋まっています。内容を読み直してから送信してください。";
      feedback.className = "feedback feedback__ok";
    }

    // バイタル文の組み立て
    const vitalParts = [];
    if (bpSys || bpDia) {
      vitalParts.push(
        `血圧 ${bpSys || "?"}/${bpDia || "?"} mmHg`
      );
    }
    if (pulse) vitalParts.push(`脈拍 ${pulse} 回/分`);
    if (spo2) vitalParts.push(`SpO₂ ${spo2} %`);
    if (temp) vitalParts.push(`体温 ${temp} ℃`);

    let vitalSentence = "";
    if (vitalParts.length > 0) {
      vitalSentence = "バイタルは、" + vitalParts.join("、") + " です。";
    }

    // 相手にしてほしいことの一文
    let requestSentence = "";
    if (requestType || requestDetail) {
      const head = requestType
        ? `【${requestType}】`
        : "【相談したいこと】";
      requestSentence = head + requestDetail.replace(/^\s+/, "");
    }

    // 最終報告文の組み立て
    const lines = [];

    lines.push(`●報告者：${stance}`);
    if (when || where) {
      lines.push(
        `●発生日時・場所：${[when, where].filter(Boolean).join("　／　")}`
      );
    }
    if (who) lines.push(`●対象者：${who}`);
    if (what) lines.push(`●何が起きたか：${what}`);
    if (condition || vitalSentence) {
      const base = condition ? condition : "";
      const space = base && vitalSentence ? " " : "";
      lines.push(`●現在の状態：${base}${space}${vitalSentence}`);
    } else if (vitalSentence) {
      lines.push(`●現在の状態：${vitalSentence}`);
    }
    if (action) lines.push(`●あなたの対応：${action}`);
    if (requestSentence) lines.push(`●相手にお願いしたいこと：${requestSentence}`);

    // 文章が空の場合のフォールバック
    if (lines.length === 0) {
      lines.push(
        "（まだ入力がほとんどありません。フォームに内容を入力すると、自動で報告文が作成されます。）"
      );
    }

    resultText.value = lines.join("\n");
    // 下の方まで自動スクロールすると気持ちいい
    resultText.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

// 共通：値取得ヘルパー
function getValue(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  return el.value.trim();
}
