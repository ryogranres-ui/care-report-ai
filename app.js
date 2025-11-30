document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("report-form");
  const output = document.getElementById("outputText");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const reporterName = document.getElementById("reporterName").value.trim();
    const role = document.getElementById("role").value.trim(); // ← 今は使わない（将来用）

    const whatHappened = document.getElementById("whatHappened").value.trim();
    const when = document.getElementById("when").value.trim();
    const where = document.getElementById("where").value.trim();
    const who = document.getElementById("who").value.trim();

    const bpSys = document.getElementById("bpSys").value.trim();
    const bpDia = document.getElementById("bpDia").value.trim();
    const pulse = document.getElementById("pulse").value.trim();
    const spo2 = document.getElementById("spo2").value.trim();
    const temp = document.getElementById("temp").value.trim();
    const currentStatus = document.getElementById("currentStatus").value.trim();

    const yourAction = document.getElementById("yourAction").value.trim();
    const goalType = document.getElementById("goalType").value.trim();
    const goalDetail = document.getElementById("goalDetail").value.trim();

    // 最低限のチェック：報告者名と「何が起きたか」と対応
    if (!reporterName || !whatHappened || !yourAction) {
      alert("「報告者の名前」「何が起きた？」「その時どう対応した？」は必須です。");
      return;
    }

    const lines = [];

    // 1. 報告者
    lines.push(`●報告者：${reporterName}`);

    // 2. 発生日時・場所
    const whenText = when || "（未記入）";
    const whereText = where || "（未記入）";
    lines.push(`●発生日時・場所：${whenText}　／　${whereText}`);

    // 3. 対象者
    if (who) {
      lines.push(`●対象者：${who}`);
    }

    // 4. 何が起きたか
    lines.push(`●何が起きたか：${whatHappened}`);

    // 5. 現在の状態 ＋ バイタル
    let statusLine = "●現在の状態：";
    statusLine += currentStatus || "（記載なし）";

    const vitalParts = [];

    if (bpSys || bpDia) {
      const bpText = `${bpSys || "?"}/${bpDia || "?"} mmHg`;
      vitalParts.push(`血圧 ${bpText}`);
    }
    if (pulse) {
      vitalParts.push(`脈拍 ${pulse} 回/分`);
    }
    if (spo2) {
      vitalParts.push(`SpO₂ ${spo2} %`);
    }
    if (temp) {
      vitalParts.push(`体温 ${temp} ℃`);
    }

    if (vitalParts.length > 0) {
      statusLine += ` バイタルは、${vitalParts.join("、")} です。`;
    }

    lines.push(statusLine);

    // 6. あなたの対応
    lines.push(`●あなたの対応：${yourAction}`);

    // 7. 相手にお願いしたいこと
    if (goalType || goalDetail) {
      const typeText = goalType || "（目的：未選択）";
      const detailText = goalDetail ? ` ${goalDetail}` : "";
      lines.push(`●相手にお願いしたいこと：【${typeText}】${detailText}`);
    }

    // テキストエリアに出力
    output.value = lines.join("\n");
    output.scrollTop = 0;
  });
});
