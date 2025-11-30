// Care Report AI 試作版
// フォーム入力から報告文を自動生成するだけのシンプル版です。

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reportForm");
  const roleInput = document.getElementById("role");
  const titleInput = document.getElementById("title");
  const whenWhereInput = document.getElementById("whenWhere");
  const whatHappenedInput = document.getElementById("whatHappened");
  const yourActionInput = document.getElementById("yourAction");
  const currentStatusInput = document.getElementById("currentStatus");
  const requestToOtherInput = document.getElementById("requestToOther");

  const resultSection = document.getElementById("resultSection");
  const reportOutput = document.getElementById("reportOutput");
  const copyBtn = document.getElementById("copyBtn");

  // フォーム送信時に報告文を生成
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const role = roleInput.value || "職員";
    const title = titleInput.value.trim();
    const whenWhere = whenWhereInput.value.trim();
    const whatHappened = whatHappenedInput.value.trim();
    const yourAction = yourActionInput.value.trim();
    const currentStatus = currentStatusInput.value.trim();
    const requestToOther = requestToOtherInput.value.trim();

    if (!title || !whenWhere || !whatHappened || !yourAction || !currentStatus || !requestToOther) {
      alert("必須項目を入力してください。");
      return;
    }

    // 報告文のひな型
    const reportText = [
      `【件名】`,
      `${title}`,
      ``,
      `【報告者】`,
      `${role}`,
      ``,
      `【経緯】`,
      `${whenWhere}`,
      `${whatHappened}`,
      ``,
      `【対応】`,
      `${yourAction}`,
      ``,
      `【現在の状態】`,
      `${currentStatus}`,
      ``,
      `【相談・依頼】`,
      `${requestToOther}`,
    ].join("\n");

    // 表示
    reportOutput.value = reportText;
    resultSection.classList.remove("hidden");

    // 上まで自動スクロール（スマホ用）
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // コピー機能
  copyBtn.addEventListener("click", async () => {
    if (!reportOutput.value) return;

    try {
      await navigator.clipboard.writeText(reportOutput.value);
      copyBtn.textContent = "コピーしました ✓";
      setTimeout(() => {
        copyBtn.textContent = "報告文をコピー";
      }, 1500);
    } catch (err) {
      alert("コピーに失敗しました。手動で選択してコピーしてください。");
    }
  });
});
